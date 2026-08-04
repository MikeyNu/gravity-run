import { qualityProfiles } from '@gravity-run/game-config';
import type { QualityTier } from './detectQualityTier';

export class AdaptiveResolutionController {
  readonly #minimum: number;
  readonly #maximum: number;
  readonly #targetFrameMilliseconds: number;
  #scale: number;
  #emaFrameMilliseconds: number;
  #sampleCount = 0;
  #cooldownFrames = 0;

  constructor(quality: QualityTier) {
    const profile = qualityProfiles[quality];
    this.#minimum = profile.renderScaleMin;
    this.#maximum = profile.renderScaleMax;
    this.#scale = profile.renderScaleMax;
    this.#targetFrameMilliseconds = quality === 'compatibility' ? 33.3 : quality === 'mobile' ? 22.2 : 16.67;
    this.#emaFrameMilliseconds = this.#targetFrameMilliseconds;
  }

  get scale(): number {
    return this.#scale;
  }

  sample(frameMilliseconds: number): number | null {
    if (!Number.isFinite(frameMilliseconds) || frameMilliseconds <= 0 || frameMilliseconds > 100) {
      return null;
    }
    this.#emaFrameMilliseconds += (frameMilliseconds - this.#emaFrameMilliseconds) * 0.08;
    this.#sampleCount += 1;
    if (this.#cooldownFrames > 0) {
      this.#cooldownFrames -= 1;
      return null;
    }
    if (this.#sampleCount < 45) return null;

    let next = this.#scale;
    if (this.#emaFrameMilliseconds > this.#targetFrameMilliseconds * 1.12) {
      next = Math.max(this.#minimum, this.#scale - 0.05);
    } else if (this.#emaFrameMilliseconds < this.#targetFrameMilliseconds * 0.72) {
      next = Math.min(this.#maximum, this.#scale + 0.035);
    }

    if (Math.abs(next - this.#scale) < 1e-6) return null;
    this.#scale = Number(next.toFixed(3));
    this.#sampleCount = 0;
    this.#cooldownFrames = 75;
    return this.#scale;
  }
}
