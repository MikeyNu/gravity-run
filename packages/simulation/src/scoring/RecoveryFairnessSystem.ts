/**
 * Tracks indicators of player struggle and exposes a recoveryBias in [0, 1].
 *
 * A high bias tells the target selector to strongly prefer recovery-class wells,
 * to relax approach-cone filters for them, and to suppress penalty for recent use.
 * The bias decays once conditions improve so it does not permanently dominate.
 */
export class RecoveryFairnessSystem {
  // Ticks below the low-speed threshold
  #lowSpeedTicks = 0;
  // Ticks spent significantly below the corridor mid-line
  #belowMidlineTicks = 0;

  // Speed below which the player is considered to be struggling
  static readonly STRUGGLE_SPEED = 15;
  // Y below which the player has likely dropped out of the main corridor
  static readonly STRUGGLE_Y = -8;
  // Ticks of struggle that map to bias = 1
  static readonly FULL_BIAS_TICKS = 180; // 3 s at 60 Hz

  update(speed: number, posY: number): void {
    if (speed < RecoveryFairnessSystem.STRUGGLE_SPEED) {
      this.#lowSpeedTicks = Math.min(this.#lowSpeedTicks + 1, RecoveryFairnessSystem.FULL_BIAS_TICKS);
    } else {
      this.#lowSpeedTicks = Math.max(0, this.#lowSpeedTicks - 3);
    }

    if (posY < RecoveryFairnessSystem.STRUGGLE_Y) {
      this.#belowMidlineTicks = Math.min(this.#belowMidlineTicks + 1, RecoveryFairnessSystem.FULL_BIAS_TICKS);
    } else {
      this.#belowMidlineTicks = Math.max(0, this.#belowMidlineTicks - 2);
    }
  }

  /** [0, 1] — strength of preference for recovery-class wells. */
  get recoveryBias(): number {
    const speedBias = this.#lowSpeedTicks / RecoveryFairnessSystem.FULL_BIAS_TICKS;
    const posBias = this.#belowMidlineTicks / RecoveryFairnessSystem.FULL_BIAS_TICKS;
    return Math.min(1, speedBias + posBias * 0.6);
  }

  reset(): void {
    this.#lowSpeedTicks = 0;
    this.#belowMidlineTicks = 0;
  }

  snapshot(): { lowSpeedTicks: number; belowMidlineTicks: number; recoveryBias: number } {
    return {
      lowSpeedTicks: this.#lowSpeedTicks,
      belowMidlineTicks: this.#belowMidlineTicks,
      recoveryBias: this.recoveryBias,
    };
  }
}
