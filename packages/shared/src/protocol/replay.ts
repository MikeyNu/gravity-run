export interface ReplayHeader {
  replayVersion: 2;
  simulationVersion: string;
  configurationHash: string;
  seed: string;
  mode: 'endless' | 'daily' | 'practice';
  assisted: boolean;
  startedAt: string;
}

export interface ReplayInputTransition {
  tick: number;
  state: 'pressed' | 'released';
}

export interface ReplayStateChecksum {
  tick: number;
  checksum: string;
}

export interface ReplaySubmission {
  header: ReplayHeader;
  transitions: ReplayInputTransition[];
  stateChecksums: ReplayStateChecksum[];
  clientResult: {
    score: number;
    distance: number;
    fragments: number;
    maximumCombo: number;
    durationTicks: number;
    failureReason: string | null;
  };
}

export interface ReplayEnvelope<T> {
  protocol: 'gravity-run/replay';
  version: 2;
  payload: T;
}

export function createReplayEnvelope<T>(payload: T): ReplayEnvelope<T> {
  return {
    protocol: 'gravity-run/replay',
    version: 2,
    payload,
  };
}
