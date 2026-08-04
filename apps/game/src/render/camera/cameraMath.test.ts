import { describe, expect, it } from 'vitest';
import {
  stepCriticallyDampedSpring,
  verticalFovFromHorizontal,
} from './cameraMath';

describe('camera math', () => {
  it('preserves horizontal framing across aspect ratios', () => {
    const widescreen = verticalFovFromHorizontal(72, 16 / 9);
    const portrait = verticalFovFromHorizontal(72, 9 / 16);
    expect(widescreen).toBeCloseTo(44.46, 2);
    expect(portrait).toBeGreaterThan(widescreen);
  });

  it('critically damped spring converges without numerical instability', () => {
    let state = { value: 0, velocity: 0 };
    for (let frame = 0; frame < 180; frame += 1) {
      state = stepCriticallyDampedSpring(state, 10, 0.2, 1 / 60);
      expect(Number.isFinite(state.value)).toBe(true);
      expect(state.value).toBeLessThanOrEqual(10.0001);
    }
    expect(state.value).toBeCloseTo(10, 3);
  });
});
