import type { TickInput } from '@gravity-run/shared';

type InputEventKind = 'press' | 'release';

interface BufferedInputEvent {
  kind: InputEventKind;
  sequence: number;
}

export class InputBuffer {
  readonly #target: Window;
  #events: BufferedInputEvent[] = [];
  #sequence = 0;
  #held = false;
  #attached = false;

  constructor(target: Window) {
    this.#target = target;
  }

  attach(): void {
    if (this.#attached) return;
    this.#attached = true;
    this.#target.addEventListener('pointerdown', this.#onPress, { passive: false });
    this.#target.addEventListener('pointerup', this.#onRelease, { passive: false });
    this.#target.addEventListener('pointercancel', this.#onRelease, { passive: false });
    this.#target.addEventListener('keydown', this.#onKeyDown);
    this.#target.addEventListener('keyup', this.#onKeyUp);
    this.#target.addEventListener('blur', this.#onBlur);
  }

  dispose(): void {
    if (!this.#attached) return;
    this.#attached = false;
    this.#target.removeEventListener('pointerdown', this.#onPress);
    this.#target.removeEventListener('pointerup', this.#onRelease);
    this.#target.removeEventListener('pointercancel', this.#onRelease);
    this.#target.removeEventListener('keydown', this.#onKeyDown);
    this.#target.removeEventListener('keyup', this.#onKeyUp);
    this.#target.removeEventListener('blur', this.#onBlur);
  }

  consumeForTick(tick: number): TickInput {
    const events = this.#events;
    this.#events = [];

    let pressed = false;
    let released = false;

    for (const event of events) {
      if (event.kind === 'press') pressed = true;
      if (event.kind === 'release') released = true;
    }

    return {
      tick,
      held: this.#held,
      pressed,
      released,
    };
  }

  readonly #onPress = (event: PointerEvent): void => {
    if (event.button !== 0 || this.#held) return;
    event.preventDefault();
    this.#held = true;
    this.#push('press');
  };

  readonly #onRelease = (event: PointerEvent): void => {
    if (!this.#held) return;
    event.preventDefault();
    this.#held = false;
    this.#push('release');
  };

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if ((event.code !== 'Space' && event.code !== 'Enter') || event.repeat || this.#held) return;
    event.preventDefault();
    this.#held = true;
    this.#push('press');
  };

  readonly #onKeyUp = (event: KeyboardEvent): void => {
    if ((event.code !== 'Space' && event.code !== 'Enter') || !this.#held) return;
    event.preventDefault();
    this.#held = false;
    this.#push('release');
  };

  readonly #onBlur = (): void => {
    if (!this.#held) return;
    this.#held = false;
    this.#push('release');
  };

  #push(kind: InputEventKind): void {
    this.#events.push({ kind, sequence: this.#sequence });
    this.#sequence += 1;
  }
}
