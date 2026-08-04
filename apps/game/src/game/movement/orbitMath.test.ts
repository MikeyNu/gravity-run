import { describe, expect, it } from 'vitest';
import { dot, length, subtract } from '@gravity-run/shared';
import {
  buildOrbitBasis,
  deterministicSinCos,
  predictClosestApproach,
  stepConstrainedOrbit,
} from './orbitMath';

describe('orbitMath', () => {
  it('constructs a right-handed orthonormal basis', () => {
    const basis = buildOrbitBasis(
      { x: 3, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 8, z: 0 },
      { x: 1, y: 0.1, z: 0 },
    );

    expect(length(basis.radial)).toBeCloseTo(1, 6);
    expect(length(basis.tangent)).toBeCloseTo(1, 6);
    expect(length(basis.normal)).toBeCloseTo(1, 6);
    expect(dot(basis.radial, basis.tangent)).toBeCloseTo(0, 6);
    expect(dot(basis.radial, basis.normal)).toBeCloseTo(0, 6);
    expect(dot(basis.tangent, { x: 0, y: 8, z: 0 })).toBeGreaterThan(0);
  });

  it('preserves constrained radius and radial residual after rotation', () => {
    const radius = 4;
    const trig = deterministicSinCos(0.2);
    const result = stepConstrainedOrbit({
      centre: { x: 0, y: 0, z: 0 },
      radial: { x: 1, y: 0, z: 0 },
      tangent: { x: 0, y: 1, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
      radius,
      tangentialSpeed: 8,
      radialSpeed: -2,
      sinTheta: trig.sin,
      cosTheta: trig.cos,
    });

    expect(length(result.position)).toBeCloseTo(radius, 6);
    expect(length(result.velocity)).toBeCloseTo(Math.sqrt(68), 5);
  });

  it('keeps deterministic trig normalized across the orbital domain', () => {
    for (let index = -256; index <= 256; index += 1) {
      const angle = (index / 256) * Math.PI;
      const result = deterministicSinCos(angle);
      expect(result.sin * result.sin + result.cos * result.cos).toBeCloseTo(1, 12);
      expect(Math.abs(result.sin - Math.sin(angle))).toBeLessThan(0.008);
    }
  });

  it('predicts closest approach inside the horizon', () => {
    const result = predictClosestApproach(
      { x: 0, y: 0, z: 0 },
      { x: 4, y: 0, z: 0 },
      { x: 6, y: 3, z: 0 },
      5,
    );

    expect(result.timeSeconds).toBeCloseTo(1.5, 6);
    expect(result.distance).toBeCloseTo(3, 6);
    expect(length(subtract({ x: 6, y: 3, z: 0 }, { x: 6, y: 0, z: 0 }))).toBe(3);
  });
});
