import type { TickInput } from '@gravity-run/shared';
import { useControlsStore } from '../../ui/controlsStore';

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
  // Gamepad polling state
  #gamepadHeld = false;

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

  clear(): void {
    this.#events = [];
    this.#held = false;
    this.#gamepadHeld = false;
  }

  consumeForTick(tick: number): TickInput {
    this.#pollGamepad();

    const events = this.#events;
    this.#events = [];

    let pressed = false;
    let released = false;
    for (const event of events) {
      if (event.kind === 'press') pressed = true;
      if (event.kind === 'release') released = true;
    }

    return { tick, held: this.#held, pressed, released };
  }

  #pollGamepad(): void {
    const gamepads = navigator.getGamepads();
    if (!gamepads) return;
    const buttonIndex = useControlsStore.getState().gamepadButton;
    let anyConnectedHeld = false;
    for (const gp of gamepads) {
      if (!gp || !gp.connected) continue;
      const button = gp.buttons[buttonIndex];
      if (button && button.pressed) {
        anyConnectedHeld = true;
        break;
      }
    }
    if (anyConnectedHeld && !this.#gamepadHeld && !this.#held) {
      this.#gamepadHeld = true;
      this.#held = true;
      this.#push('press');
    } else if (!anyConnectedHeld && this.#gamepadHeld) {
      this.#gamepadHeld = false;
      this.#held = false;
      this.#push('release');
    }
  }

  readonly #onPress = (event: PointerEvent): void => {
    if (event.button !== 0 || this.#held || this.#isInterfaceTarget(event.target)) return;
    event.preventDefault();
    this.#held = true;
    this.#push('press');
  };

  readonly #onRelease = (event: PointerEvent): void => {
    if (!this.#held) return;
    event.preventDefault();
    this.#held = false;
    this.#gamepadHeld = false;
    this.#push('release');
  };

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    const { primaryKey, isListening } = useControlsStore.getState();
    if (isListening) return; // rebinding in progress — ignore game input
    const matchesPrimary = event.code === primaryKey || event.code === 'Enter';
    if (!matchesPrimary || event.repeat || this.#held) return;
    if (this.#isInterfaceTarget(document.activeElement)) return;
    event.preventDefault();
    this.#held = true;
    this.#push('press');
  };

  readonly #onKeyUp = (event: KeyboardEvent): void => {
    const { primaryKey } = useControlsStore.getState();
    const matchesPrimary = event.code === primaryKey || event.code === 'Enter';
    if (!matchesPrimary || !this.#held) return;
    event.preventDefault();
    this.#held = false;
    this.#gamepadHeld = false;
    this.#push('release');
  };

  readonly #onBlur = (): void => {
    if (!this.#held) return;
    this.#held = false;
    this.#gamepadHeld = false;
    this.#push('release');
  };

  #isInterfaceTarget(target: EventTarget | null): boolean {
    return target instanceof Element && Boolean(target.closest('button, a, input, select, textarea, [data-ui-control]'));
  }

  #push(kind: InputEventKind): void {
    this.#events.push({ kind, sequence: this.#sequence });
    this.#sequence += 1;
  }
}
