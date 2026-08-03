export interface FixedStepLoopOptions {
  fixedStepSeconds: number;
  maxCatchUpSteps: number;
  update: (fixedStepSeconds: number) => void;
  render: (alpha: number, frameDeltaSeconds: number) => void;
}

export class FixedStepLoop {
  readonly #fixedStepSeconds: number;
  readonly #maxCatchUpSteps: number;
  readonly #update: FixedStepLoopOptions['update'];
  readonly #render: FixedStepLoopOptions['render'];

  #accumulator = 0;
  #previousTimeSeconds = 0;
  #frameHandle: number | null = null;
  #running = false;

  constructor(options: FixedStepLoopOptions) {
    this.#fixedStepSeconds = options.fixedStepSeconds;
    this.#maxCatchUpSteps = options.maxCatchUpSteps;
    this.#update = options.update;
    this.#render = options.render;
  }

  start(): void {
    if (this.#running) return;
    this.#running = true;
    this.#previousTimeSeconds = performance.now() / 1000;
    this.#frameHandle = requestAnimationFrame(this.#frame);
  }

  stop(): void {
    this.#running = false;
    if (this.#frameHandle !== null) {
      cancelAnimationFrame(this.#frameHandle);
      this.#frameHandle = null;
    }
  }

  readonly #frame = (nowMilliseconds: number): void => {
    if (!this.#running) return;

    const nowSeconds = nowMilliseconds / 1000;
    const rawDelta = nowSeconds - this.#previousTimeSeconds;
    this.#previousTimeSeconds = nowSeconds;

    const frameDelta = Math.min(Math.max(rawDelta, 0), 0.1);
    this.#accumulator += frameDelta;

    let steps = 0;
    while (this.#accumulator >= this.#fixedStepSeconds && steps < this.#maxCatchUpSteps) {
      this.#update(this.#fixedStepSeconds);
      this.#accumulator -= this.#fixedStepSeconds;
      steps += 1;
    }

    if (steps === this.#maxCatchUpSteps && this.#accumulator >= this.#fixedStepSeconds) {
      this.#accumulator %= this.#fixedStepSeconds;
    }

    const alpha = this.#accumulator / this.#fixedStepSeconds;
    this.#render(alpha, frameDelta);
    this.#frameHandle = requestAnimationFrame(this.#frame);
  };
}
