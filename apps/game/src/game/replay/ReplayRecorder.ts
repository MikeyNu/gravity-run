import {
  configurationHash,
  simulationVersion,
} from '@gravity-run/game-config';
import type { ReplaySubmission, TickInput } from '@gravity-run/shared';
import type { SimulationSnapshot } from '../simulation/types';

export class ReplayRecorder {
  readonly #seed: string;
  readonly #startedAt = new Date().toISOString();
  readonly #transitions: ReplaySubmission['transitions'] = [];
  readonly #stateChecksums: ReplaySubmission['stateChecksums'] = [];

  constructor(seed: string) {
    this.#seed = seed;
  }

  recordInput(input: TickInput): void {
    if (input.pressed) this.#transitions.push({ tick: input.tick, state: 'pressed' });
    if (input.released) this.#transitions.push({ tick: input.tick, state: 'released' });
  }

  recordSnapshot(snapshot: SimulationSnapshot): void {
    if (snapshot.tick % 120 === 0) {
      this.#stateChecksums.push({ tick: snapshot.tick, checksum: snapshot.checksum });
    }
  }

  createSubmission(snapshot: SimulationSnapshot): ReplaySubmission {
    return {
      header: {
        replayVersion: 2,
        simulationVersion,
        configurationHash,
        seed: this.#seed,
        mode: 'endless',
        assisted: false,
        startedAt: this.#startedAt,
      },
      transitions: [...this.#transitions],
      stateChecksums: [...this.#stateChecksums],
      clientResult: {
        score: snapshot.score,
        distance: snapshot.distance,
        fragments: snapshot.fragments,
        maximumCombo: snapshot.maximumCombo,
        durationTicks: snapshot.tick,
        failureReason: snapshot.failureReason,
      },
    };
  }
}
