import type { SimulationSnapshot } from '../simulation/types';
import type { InputBuffer } from '../input/InputBuffer';
import { FixedStepLoop } from './FixedStepLoop';

export interface SimulationPort {
  step(fixedStepSeconds: number, input: ReturnType<InputBuffer['consumeForTick']>): void;
  getSnapshot(): SimulationSnapshot;
  reset(): void;
}

export interface PresentationPort {
  render(previous: SimulationSnapshot, current: SimulationSnapshot, alpha: number, frameDeltaSeconds: number): void;
  resize(): void;
  dispose(): void;
}

export interface GameRuntimeOptions {
  fixedStepSeconds: number;
  maxCatchUpSteps: number;
  input: InputBuffer;
  simulation: SimulationPort;
  presentation: PresentationPort;
  onSnapshot?: (snapshot: SimulationSnapshot) => void;
}

export class GameRuntime {
  readonly #input: InputBuffer;
  readonly #simulation: SimulationPort;
  readonly #presentation: PresentationPort;
  readonly #loop: FixedStepLoop;
  readonly #onSnapshot?: GameRuntimeOptions['onSnapshot'];

  #previousSnapshot: SimulationSnapshot;
  #currentSnapshot: SimulationSnapshot;
  #resizeObserver: ResizeObserver;
  #started = false;

  constructor(options: GameRuntimeOptions) {
    this.#input = options.input;
    this.#simulation = options.simulation;
    this.#presentation = options.presentation;
    this.#onSnapshot = options.onSnapshot;
    this.#previousSnapshot = options.simulation.getSnapshot();
    this.#currentSnapshot = this.#previousSnapshot;

    this.#loop = new FixedStepLoop({
      fixedStepSeconds: options.fixedStepSeconds,
      maxCatchUpSteps: options.maxCatchUpSteps,
      update: (fixedStepSeconds) => this.#update(fixedStepSeconds),
      render: (alpha, frameDeltaSeconds) => {
        this.#presentation.render(
          this.#previousSnapshot,
          this.#currentSnapshot,
          alpha,
          frameDeltaSeconds,
        );
      },
    });

    this.#resizeObserver = new ResizeObserver(() => this.#presentation.resize());
  }

  start(): void {
    if (!this.#started) {
      this.#started = true;
      this.#input.attach();
      this.#resizeObserver.observe(document.documentElement);
      this.#presentation.resize();
      this.#presentation.render(this.#currentSnapshot, this.#currentSnapshot, 0, 0);
    }
    this.#loop.start();
  }

  pause(): void {
    this.#loop.stop();
    this.#input.clear();
  }

  resume(): void {
    if (!this.#started) this.start();
    else this.#loop.start();
  }

  reset(): void {
    this.#input.clear();
    this.#simulation.reset();
    this.#previousSnapshot = this.#simulation.getSnapshot();
    this.#currentSnapshot = this.#previousSnapshot;
    this.#onSnapshot?.(this.#currentSnapshot);
    this.#presentation.render(this.#currentSnapshot, this.#currentSnapshot, 0, 0);
  }

  dispose(): void {
    this.#loop.stop();
    this.#resizeObserver.disconnect();
    this.#input.dispose();
    this.#presentation.dispose();
  }

  #update(fixedStepSeconds: number): void {
    this.#previousSnapshot = this.#currentSnapshot;
    const tickInput = this.#input.consumeForTick(this.#currentSnapshot.tick + 1);
    this.#simulation.step(fixedStepSeconds, tickInput);
    this.#currentSnapshot = this.#simulation.getSnapshot();
    this.#onSnapshot?.(this.#currentSnapshot);
  }
}
