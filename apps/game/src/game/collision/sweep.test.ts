import { describe, expect, it } from 'vitest';
import type { HazardDefinition } from '@gravity-run/game-config';
import { sweepSphereAgainstHazard } from './sweep';

const hazard: HazardDefinition = {
  id: 'hazard',
  moduleId: 0,
  kind: 'spire',
  position: { x: 0, y: 0, z: 0 },
  halfExtents: { x: 1, y: 1, z: 1 },
  lethal: false,
  motion: { kind: 'static' },
};

describe('sweepSphereAgainstHazard', () => {
  it('returns an outward normal when entering from negative X', () => {
    const hit = sweepSphereAgainstHazard(
      { x: -4, y: 0, z: 0 },
      { x: 4, y: 0, z: 0 },
      0.5,
      hazard,
    );
    expect(hit?.normal).toEqual({ x: -1, y: 0, z: 0 });
  });

  it('returns an outward normal when entering from positive X', () => {
    const hit = sweepSphereAgainstHazard(
      { x: 4, y: 0, z: 0 },
      { x: -4, y: 0, z: 0 },
      0.5,
      hazard,
    );
    expect(hit?.normal).toEqual({ x: 1, y: 0, z: 0 });
  });
});
