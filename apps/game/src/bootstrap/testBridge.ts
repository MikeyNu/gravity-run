import type { ReplaySubmission } from '@gravity-run/shared';

// Exposed only in development/test builds via import.meta.env.DEV.
// Playwright e2e tests access these methods via window.__gravityRunTest.

interface TestBridgeApi {
  validateReplay(submission: ReplaySubmission): Promise<{
    score: number;
    distance: number;
    fragments: number;
    hash: string;
  }>;
  verifyHash(submission: ReplaySubmission): Promise<boolean>;
  computeHash(submission: ReplaySubmission): Promise<string>;
}

declare global {
  interface Window {
    __gravityRunTest?: TestBridgeApi;
  }
}

function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

function computeReplayHash(submission: ReplaySubmission): string {
  const { header, clientResult, transitions, stateChecksums } = submission;
  const parts = [
    header.seed,
    header.simulationVersion,
    String(clientResult.score),
    String(clientResult.distance),
    String(clientResult.durationTicks),
    ...stateChecksums,
    ...transitions.map((t) => `${t.tick}:${t.state}`),
  ];
  return djb2(parts.join('|')).toString(16).padStart(8, '0');
}

export function installTestBridge(): void {
  if (!import.meta.env.DEV) return;

  window.__gravityRunTest = {
    async validateReplay(submission) {
      const hash = computeReplayHash(submission);
      return {
        score: submission.clientResult.score,
        distance: submission.clientResult.distance,
        fragments: submission.clientResult.fragments,
        hash,
      };
    },

    async verifyHash(submission) {
      const expected = computeReplayHash(submission);
      return expected === submission.header.replayHash;
    },

    async computeHash(submission) {
      return computeReplayHash(submission);
    },
  };
}
