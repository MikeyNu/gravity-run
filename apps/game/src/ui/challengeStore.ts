import { create } from 'zustand';
import type {
  DailyChallengeManifest,
  LeaderboardEntry,
  ReplaySubmissionRequest,
} from '@gravity-run/shared';
import { developmentChallengeManifest } from '@gravity-run/game-config';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';

export type ChallengeMode = 'endless' | 'daily';

export interface LeaderboardState {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  entries: LeaderboardEntry[];
  error: string | null;
}

export interface SubmissionState {
  status: 'idle' | 'submitting' | 'submitted' | 'error';
  rank: number | null;
  error: string | null;
}

interface ChallengeState {
  mode: ChallengeMode;
  manifest: DailyChallengeManifest | null;
  manifestStatus: 'idle' | 'loading' | 'loaded' | 'error';
  attemptsUsed: number;
  leaderboard: LeaderboardState;
  submission: SubmissionState;
  setMode: (mode: ChallengeMode) => void;
  fetchDailyManifest: () => Promise<void>;
  fetchLeaderboard: (challengeId?: string | null) => Promise<void>;
  submitReplay: (request: ReplaySubmissionRequest) => Promise<void>;
  resetSubmission: () => void;
}

const ATTEMPTS_KEY = 'gravity-run:daily-attempts';

function loadAttempts(challengeId: string): number {
  try {
    const raw = localStorage.getItem(ATTEMPTS_KEY);
    if (!raw) return 0;
    const data = JSON.parse(raw) as Record<string, number>;
    return data[challengeId] ?? 0;
  } catch {
    return 0;
  }
}

function saveAttempts(challengeId: string, count: number): void {
  try {
    const raw = localStorage.getItem(ATTEMPTS_KEY);
    const data: Record<string, number> = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    data[challengeId] = count;
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

export const useChallengeStore = create<ChallengeState>((set, get) => ({
  mode: 'endless',
  manifest: null,
  manifestStatus: 'idle',
  attemptsUsed: 0,
  leaderboard: { status: 'idle', entries: [], error: null },
  submission: { status: 'idle', rank: null, error: null },

  setMode(mode) { set({ mode }); },

  async fetchDailyManifest() {
    set({ manifestStatus: 'loading' });
    try {
      const response = await fetch(`${API_BASE}/v1/challenges/daily`);
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const manifest = (await response.json()) as DailyChallengeManifest;
      const attempts = loadAttempts(manifest.challengeId);
      set({ manifest, manifestStatus: 'loaded', attemptsUsed: attempts });
    } catch (error: unknown) {
      // Fall back to development manifest so the daily mode still works locally
      const manifest = developmentChallengeManifest as DailyChallengeManifest;
      const attempts = loadAttempts(manifest.challengeId);
      console.warn('[ChallengeStore] Falling back to dev manifest:', error);
      set({ manifest, manifestStatus: 'loaded', attemptsUsed: attempts });
    }
  },

  async fetchLeaderboard(challengeId = get().manifest?.challengeId) {
    set((s) => ({ leaderboard: { ...s.leaderboard, status: 'loading', error: null } }));
    const mode = get().mode;
    const params = new URLSearchParams({ mode, limit: '25' });
    if (challengeId) params.set('challengeId', challengeId);
    try {
      const response = await fetch(`${API_BASE}/v1/leaderboard?${params.toString()}`);
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data = (await response.json()) as { entries: LeaderboardEntry[] };
      set({ leaderboard: { status: 'loaded', entries: data.entries, error: null } });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      set({ leaderboard: { status: 'error', entries: [], error: msg } });
    }
  },

  async submitReplay(request: ReplaySubmissionRequest) {
    set({ submission: { status: 'submitting', rank: null, error: null } });
    try {
      const response = await fetch(`${API_BASE}/v1/replays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (response.status === 429) {
        set({ submission: { status: 'error', rank: null, error: 'attempt_limit_reached' } });
        return;
      }
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data = (await response.json()) as { rank: number };
      const { manifest } = get();
      if (manifest) {
        const next = get().attemptsUsed + 1;
        saveAttempts(manifest.challengeId, next);
        set({ attemptsUsed: next });
      }
      set({ submission: { status: 'submitted', rank: data.rank, error: null } });
      // Refresh leaderboard after successful submission
      void get().fetchLeaderboard();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      set({ submission: { status: 'error', rank: null, error: msg } });
    }
  },

  resetSubmission() {
    set({ submission: { status: 'idle', rank: null, error: null } });
  },
}));
