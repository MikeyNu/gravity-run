import type { ReplaySubmission, TickInput } from '@gravity-run/shared';
import type { SimulationPort } from '../core/GameRuntime';
import type { SimulationSnapshot } from '../simulation/types';

/**
 * Wraps any SimulationPort and replays recorded input transitions instead of
 * accepting live player input. Used for ghost replay viewing.
 */
export class PlaybackSimulationAdapter implements SimulationPort {
  readonly #inner: SimulationPort;
  readonly #transitions: ReplaySubmission['transitions'];
  #held = false;
  #finished = false;
  #durationTicks: number;

  constructor(inner: SimulationPort, submission: ReplaySubmission) {
    this.#inner = inner;
    // Sort ascending so binary search works
    this.#transitions = [...submission.transitions].sort((a, b) => a.tick - b.tick);
    this.#durationTicks = submission.clientResult.durationTicks;
    // Seed the inner simulation with the replay's configuration
    if (inner.configure) {
      inner.configure({
        seed: submission.header.seed,
        mode: submission.header.mode,
        assisted: submission.header.assisted,
      });
    } else {
      inner.reset();
    }
  }

  get finished(): boolean { return this.#finished; }
  get durationTicks(): number { return this.#durationTicks; }

  step(fixedStepSeconds: number, _liveInput: TickInput): void {
    if (this.#finished) return;
    const nextTick = this.#inner.getSnapshot().tick + 1;
    const syntheticInput = this.#buildInput(nextTick);
    this.#inner.step(fixedStepSeconds, syntheticInput);
    if (nextTick >= this.#durationTicks) this.#finished = true;
  }

  getSnapshot(): SimulationSnapshot {
    return this.#inner.getSnapshot() as SimulationSnapshot;
  }

  reset(): void {
    this.#held = false;
    this.#finished = false;
    this.#inner.reset();
  }

  #buildInput(tick: number): TickInput {
    let pressed = false;
    let released = false;
    for (const t of this.#transitions) {
      if (t.tick === tick) {
        if (t.state === 'pressed') { pressed = true; this.#held = true; }
        if (t.state === 'released') { released = true; this.#held = false; }
      }
    }
    return { tick, held: this.#held, pressed, released };
  }
}
