import {
  configurationHash,
  simulationVersion,
} from '@gravity-run/game-config';
import type { ReplayHeader, ReplaySubmission, TickInput } from '@gravity-run/shared';
import type { SimulationSnapshot } from '../simulation/types.js';

export class ReplayRecorder {
  readonly #seed: string;
  readonly #mode: ReplayHeader['mode'];
  readonly #assisted: boolean;
  readonly #startedAt = new Date().toISOString();
  readonly #transitions: ReplaySubmission['transitions'] = [];
  readonly #stateChecksums: ReplaySubmission['stateChecksums'] = [];

  constructor(options: { seed: string; mode: ReplayHeader['mode']; assisted: boolean }) {
    this.#seed = options.seed;
    this.#mode = options.mode;
    this.#assisted = options.assisted;
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
        mode: this.#mode,
        assisted: this.#assisted,
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
