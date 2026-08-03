export interface ReplayHeader {
  replayVersion: 1;
  simulationVersion: string;
  configurationHash: string;
  seed: string;
  startedAt: string;
}

export interface ReplayInputTransition {
  tick: number;
  state: 'pressed' | 'released';
}

export interface ReplaySubmission {
  header: ReplayHeader;
  transitions: ReplayInputTransition[];
  stateChecksums: Array<{ tick: number; checksum: string }>;
  clientResult: {
    score: number;
    distance: number;
    durationTicks: number;
  };
}

export interface ReplayEnvelope<T> {
  protocol: 'gravity-run/replay';
  version: 1;
  payload: T;
}

export function createReplayEnvelope<T>(payload: T): ReplayEnvelope<T> {
  return {
    protocol: 'gravity-run/replay',
    version: 1,
    payload,
  };
}
