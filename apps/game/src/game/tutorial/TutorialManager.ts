import type { SimulationSnapshot } from '../simulation/types';
import { useTutorialStore, type TutorialStep } from '../../ui/tutorialStore';

const HINT_DISPLAY_TICKS = 300; // show hint for 5 seconds (60 Hz)

interface StepRule {
  trigger: (prev: SimulationSnapshot, curr: SimulationSnapshot, ctx: TutorialContext) => boolean;
  complete: (prev: SimulationSnapshot, curr: SimulationSnapshot) => boolean;
}

interface TutorialContext {
  orbitTicks: number;
}

const RULES: Readonly<Record<Exclude<TutorialStep, 'complete'>, StepRule>> = {
  'hold-to-latch': {
    // Show once the countdown finishes (player is now in control)
    trigger: (_prev, curr) => curr.phase === 'free-flight' || curr.phase === 'released',
    // Complete once the player successfully latches onto a well
    complete: (prev, curr) => !prev.targetLocked && curr.targetLocked,
  },
  'release-to-launch': {
    // Show once the player has been orbiting for 2 seconds
    trigger: (_prev, _curr, ctx) => ctx.orbitTicks >= 120,
    // Complete on the first successful release (any grade)
    complete: (prev, curr) => prev.lastReleaseGrade == null && curr.lastReleaseGrade != null,
  },
  'chain-wells': {
    // Show immediately when this step becomes active (right after the release hint is done)
    trigger: () => true,
    // Complete when the player chains two wells (combo ≥ 2)
    complete: (_prev, curr) => curr.combo >= 2,
  },
  'avoid-collapse': {
    // Show when the player has covered enough ground that the collapse wall is a real threat
    trigger: (_prev, curr) => curr.distance >= 200,
    // Complete when the player demonstrates forward momentum past the trigger zone
    complete: (_prev, curr) => curr.distance >= 400,
  },
};

export class TutorialManager {
  #orbitTicks = 0;
  #hintDisplayTicksRemaining = 0;
  #stepTriggered = false;
  #prev: SimulationSnapshot | null = null;

  update(snapshot: SimulationSnapshot): void {
    const store = useTutorialStore.getState();
    if (!store.enabled || store.currentStep === 'complete') return;

    const prev = this.#prev ?? snapshot;
    this.#prev = snapshot;

    // Reset state on new run
    if (snapshot.tick < (prev?.tick ?? 0)) {
      this.#orbitTicks = 0;
      this.#hintDisplayTicksRemaining = 0;
      this.#stepTriggered = false;
    }

    const step = store.currentStep as Exclude<TutorialStep, 'complete'>;
    const rule = RULES[step];
    if (!rule) return;

    // Track orbit duration for the release-to-launch trigger
    if (snapshot.targetLocked) {
      this.#orbitTicks++;
    } else {
      this.#orbitTicks = 0;
    }

    const ctx: TutorialContext = { orbitTicks: this.#orbitTicks };

    // Check completion first so we can advance before showing a stale hint
    if (this.#stepTriggered && rule.complete(prev, snapshot)) {
      store.hide();
      store.advance();
      this.#stepTriggered = false;
      this.#hintDisplayTicksRemaining = 0;
      this.#orbitTicks = 0;
      return;
    }

    // Trigger the hint if the condition is met and we haven't shown it yet
    if (!this.#stepTriggered && rule.trigger(prev, snapshot, ctx)) {
      this.#stepTriggered = true;
      this.#hintDisplayTicksRemaining = HINT_DISPLAY_TICKS;
      store.show();
    }

    // Auto-hide after display duration
    if (this.#hintDisplayTicksRemaining > 0) {
      this.#hintDisplayTicksRemaining--;
      if (this.#hintDisplayTicksRemaining === 0) {
        store.hide();
      }
    }
  }

  reset(): void {
    this.#orbitTicks = 0;
    this.#hintDisplayTicksRemaining = 0;
    this.#stepTriggered = false;
    this.#prev = null;
    useTutorialStore.getState().hide();
  }
}
