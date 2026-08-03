import { describe, expect, it } from 'vitest';
import { dot, length, subtract } from '@gravity-run/shared';
import { buildOrbitBasis, predictClosestApproach, stepConstrainedOrbit } from './orbitMath';

describe('orbitMath', () => {
  it('constructs an orthonormal basis', () => {
    const basis = buildOrbitBasis(
      { x: 3, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 8, z: 0 },
      { x: 0, y: 0, z: 1 },
    );

    expect(length(basis.radial)).toBeCloseTo(1, 6);
    expect(length(basis.tangent)).toBeCloseTo(1, 6);
    expect(length(basis.normal)).toBeCloseTo(1, 6);
    expect(dot(basis.radial, basis.tangent)).toBeCloseTo(0, 6);
    expect(dot(basis.radial, basis.normal)).toBeCloseTo(0, 6);
  });

  it('preserves constrained radius after rotation', () => {
    const radius = 4;
    const result = stepConstrainedOrbit({
      centre: { x: 0, y: 0, z: 0 },
      radial: { x: 1, y: 0, z: 0 },
      tangent: { x: 0, y: 1, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
      radius,
      tangentialSpeed: 8,
      sinTheta: Math.sin(0.2),
      cosTheta: Math.cos(0.2),
    });

    expect(length(result.position)).toBeCloseTo(radius, 6);
    expect(length(result.velocity)).toBeCloseTo(8, 6);
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
