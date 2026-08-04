import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { unsignedDailyChallenge, simulationVersion, scoringConfig, movementConfig } from '@gravity-run/game-config';
import {
  createReplayEnvelope,
  type LeaderboardEntry,
  type ReplaySubmission,
  type ReplaySubmissionRequest,
} from '@gravity-run/shared';

const port = Number(process.env.PORT ?? 8787);

// ── In-memory storage (resets on restart) ─────────────────────────────────

const leaderboardStore = new Map<string, LeaderboardEntry[]>();
const replayStore = new Map<string, ReplaySubmissionRequest>();
const attemptStore = new Map<string, number>(); // `${playerId}:${challengeId}` → count

// Rate limiting: track submission timestamps per IP
const rateLimitStore = new Map<string, number[]>(); // ip → [timestamp, ...]
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

// ── Score plausibility bounds ──────────────────────────────────────────────

const PLAUSIBILITY = {
  // Max score per tick: best release grade (overdrive) × max combo + generous margin
  maxScorePerTick: scoringConfig.releaseGrades.overdrive * scoringConfig.maximumCombo * 2,
  maxDistancePerTick: (movementConfig.maximumSpeed / movementConfig.simulationHz) * 1.1,
  maxFragmentsPerTick: 0.5,
  maxDurationMinutes: 45,
} as const;

function plausibilityCheck(submission: ReplaySubmission): string | null {
  const { clientResult, transitions } = submission;
  const { score, distance, fragments, durationTicks, failureReason } = clientResult;

  if (durationTicks <= 0) return 'zero_duration';
  if (durationTicks > PLAUSIBILITY.maxDurationMinutes * 60 * movementConfig.simulationHz) {
    return 'duration_implausible';
  }
  if (score < 0) return 'negative_score';
  if (score > durationTicks * PLAUSIBILITY.maxScorePerTick) return 'score_implausible';
  if (distance < 0) return 'negative_distance';
  if (distance > durationTicks * PLAUSIBILITY.maxDistancePerTick) return 'distance_implausible';
  if (fragments < 0) return 'negative_fragments';
  if (fragments > durationTicks * PLAUSIBILITY.maxFragmentsPerTick) return 'fragments_implausible';

  // Transitions must be in order and reference plausible tick numbers
  for (let i = 1; i < transitions.length; i++) {
    const prev = transitions[i - 1];
    const curr = transitions[i];
    if (!prev || !curr) continue;
    if (curr.tick < prev.tick) return 'transitions_not_monotonic';
    if (curr.tick > durationTicks + 10) return 'transition_past_end';
  }

  // Require that the run ended (failureReason must be set or distance > 0)
  if (failureReason == null && distance < 10) return 'no_failure_no_distance';

  return null; // plausible
}

function replayHash(submission: ReplaySubmission): string {
  // Lightweight deterministic hash: concatenate key fields and compute
  // a checksum using the state checksums already embedded in the replay.
  const parts: string[] = [
    submission.header.seed,
    submission.header.simulationVersion,
    submission.header.configurationHash,
    String(submission.clientResult.score),
    String(submission.clientResult.distance),
    String(submission.clientResult.durationTicks),
    ...submission.stateChecksums.map((sc) => `${sc.tick}:${sc.checksum}`),
    ...submission.transitions.map((t) => `${t.tick}:${t.state}`),
  ];
  // djb2-style hash over the UTF-8 bytes
  let hash = 5381;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      hash = ((hash << 5) + hash + part.charCodeAt(i)) >>> 0;
    }
    hash = (hash ^ 0x12345678) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

// ── Storage helpers ────────────────────────────────────────────────────────

function getLeaderboard(challengeId: string | null): LeaderboardEntry[] {
  return leaderboardStore.get(challengeId ?? 'endless') ?? [];
}

function addLeaderboardEntry(entry: LeaderboardEntry): void {
  const key = entry.challengeId ?? 'endless';
  const entries = leaderboardStore.get(key) ?? [];
  entries.push(entry);
  entries.sort((a, b) => b.score - a.score);
  leaderboardStore.set(key, entries.slice(0, 100));
}

// ── Utility ────────────────────────────────────────────────────────────────

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function setCors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Player-Id');
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const window = (rateLimitStore.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  window.push(now);
  rateLimitStore.set(ip, window);
  return window.length <= RATE_LIMIT_MAX;
}

// ── HTTP server ────────────────────────────────────────────────────────────

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  setCors(response);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    await handleRequest(request, response, url);
  } catch (error: unknown) {
    console.error('[server] Unhandled error:', error);
    response.writeHead(500);
    response.end(JSON.stringify({ error: 'internal_server_error' }));
  }
});

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
): Promise<void> {
  // ── Rate limit mutation endpoints by IP ──
  const ip = (request.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? '127.0.0.1';
  if (request.method === 'POST' && !checkRateLimit(ip)) {
    response.writeHead(429, { 'Retry-After': '60' });
    response.end(JSON.stringify({ error: 'rate_limit_exceeded' }));
    return;
  }

  // GET /health
  if (request.method === 'GET' && url.pathname === '/health') {
    response.writeHead(200);
    response.end(JSON.stringify({ status: 'ok', simulationVersion }));
    return;
  }

  // GET /v1/challenges/daily
  if (request.method === 'GET' && url.pathname === '/v1/challenges/daily') {
    const date = todayDateString();
    const manifest = { ...unsignedDailyChallenge(date), signature: 'development-only' };
    const now = Date.now();
    const midnight = new Date(date).getTime() + 86_400_000;
    const maxAge = Math.max(60, Math.floor((midnight - now) / 1000));
    response.writeHead(200, { 'Cache-Control': `public, max-age=${maxAge}` });
    response.end(JSON.stringify(manifest));
    return;
  }

  // GET /v1/leaderboard?mode=daily&challengeId=daily-2026-08-04&limit=25
  if (request.method === 'GET' && url.pathname === '/v1/leaderboard') {
    const mode = (url.searchParams.get('mode') ?? 'daily') as 'endless' | 'daily';
    const challengeId = url.searchParams.get('challengeId');
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 25)));
    const entries = getLeaderboard(challengeId).slice(0, limit);
    response.writeHead(200, { 'Cache-Control': 'no-cache' });
    response.end(JSON.stringify({ protocol: 'gravity-run/leaderboard', version: 1, mode, challengeId, entries }));
    return;
  }

  // GET /v1/replays/:runId  — ghost replay download
  const replayFetchMatch = /^\/v1\/replays\/([a-z0-9-]+)$/i.exec(url.pathname);
  if (request.method === 'GET' && replayFetchMatch) {
    const runId = replayFetchMatch[1] ?? '';
    const replay = replayStore.get(runId);
    if (!replay) {
      response.writeHead(404);
      response.end(JSON.stringify({ error: 'replay_not_found' }));
      return;
    }
    response.writeHead(200, { 'Cache-Control': 'public, max-age=3600' });
    response.end(JSON.stringify(createReplayEnvelope(replay)));
    return;
  }

  // POST /v1/replays — submit a completed run
  if (request.method === 'POST' && url.pathname === '/v1/replays') {
    let body: ReplaySubmissionRequest;
    try {
      body = (await readJsonBody(request)) as ReplaySubmissionRequest;
    } catch {
      response.writeHead(400);
      response.end(JSON.stringify({ error: 'invalid_body' }));
      return;
    }

    const { playerId, playerName, submission, challenge } = body;
    if (!submission?.header || !submission?.clientResult || !submission?.transitions) {
      response.writeHead(422);
      response.end(JSON.stringify({ error: 'missing_submission_fields' }));
      return;
    }

    // Plausibility check
    const implausible = plausibilityCheck(submission);
    if (implausible) {
      console.warn(`[anti-cheat] Rejected implausible submission from ${ip}: ${implausible}`);
      response.writeHead(422);
      response.end(JSON.stringify({ error: 'implausible_result', reason: implausible }));
      return;
    }

    // Attempt limit for daily challenges
    const challengeId = challenge?.challengeId ?? null;
    if (challengeId && playerId && challenge) {
      const attemptKey = `${playerId}:${challengeId}`;
      const attempts = attemptStore.get(attemptKey) ?? 0;
      if (attempts >= challenge.attemptLimit) {
        response.writeHead(429);
        response.end(JSON.stringify({ error: 'attempt_limit_reached', limit: challenge.attemptLimit }));
        return;
      }
      attemptStore.set(attemptKey, attempts + 1);
    }

    const runId = crypto.randomUUID();
    const hash = replayHash(submission);

    const entry: LeaderboardEntry = {
      runId,
      playerName: (playerName ?? 'Anonymous').slice(0, 32),
      mode: challengeId ? 'daily' : 'endless',
      challengeId,
      score: submission.clientResult.score,
      distance: submission.clientResult.distance,
      maximumCombo: submission.clientResult.maximumCombo,
      createdAt: new Date().toISOString(),
    };

    replayStore.set(runId, body);
    addLeaderboardEntry(entry);

    const entries = getLeaderboard(challengeId);
    const rank = entries.findIndex((e) => e.runId === runId) + 1;

    console.log(`[replay] Accepted run ${runId} hash=${hash} score=${entry.score} rank=${rank} mode=${entry.mode}`);

    response.writeHead(201);
    response.end(JSON.stringify({ verified: true, entry, rank, replayHash: hash }));
    return;
  }

  response.writeHead(404);
  response.end(JSON.stringify({ error: 'not_found' }));
}

server.listen(port, () => {
  console.log(`Gravity Run API listening on http://localhost:${port}`);
});
