import { describe, expect, it } from 'vitest';
import type { GravityWellDefinition, HazardDefinition } from '@gravity-run/game-config';
import { generateCourseWindow } from '../procedural/courseGenerator';
import { selectGravityTarget } from './selectTarget';

const baseInput = {
  playerPosition: { x: 4, y: 1, z: 0 },
  playerVelocity: { x: 12, y: 0, z: 0 },
  currentTargetId: null,
  hazards: [] as HazardDefinition[],
  recentlyUsed: new Set<string>(),
  excludedWellIds: new Set<string>(),
  playerRadius: 0.34,
};

describe('target selection', () => {
  it('chooses a reachable forward well', () => {
    const wells = generateCourseWindow('targeting', 0, 2).flatMap((module) => module.wells);
    const result = selectGravityTarget({ ...baseInput, wells });
    expect(result.well).not.toBeNull();
    expect(result.well?.position.x).toBeGreaterThan(4);
  });

  it('never reacquires an explicitly blocked well', () => {
    const wells = generateCourseWindow('targeting', 0, 2).flatMap((module) => module.wells);
    const first = selectGravityTarget({ ...baseInput, wells }).well;
    expect(first).not.toBeNull();

    const result = selectGravityTarget({
      ...baseInput,
      wells,
      excludedWellIds: new Set([first!.id]),
    });
    expect(result.well?.id).not.toBe(first!.id);
  });

  it('rejects a target whose latch path crosses a lethal obstruction', () => {
    const well: GravityWellDefinition = {
      id: 'blocked',
      moduleId: 0,
      position: { x: 12, y: 1, z: 0 },
      routeDirection: { x: 1, y: 0, z: 0 },
      class: 'standard',
      physicalRadius: 1.35,
      minimumOrbitRadius: 5.5,
      maximumOrbitRadius: 13.5,
      acquisitionRadius: 18,
      latchRadius: 11.5,
      allowedApproachCosine: -0.22,
      authoredPriority: 0,
      maximumTangentialSpeed: 28,
      orbitAcceleration: 8,
      energyBudget: 8,
      releaseBoost: 1.5,
      risk: 0.2,
    };
    const hazards: HazardDefinition[] = [{
      id: 'wall',
      moduleId: 0,
      kind: 'collapse-gate',
      position: { x: 8, y: 1, z: 0 },
      halfExtents: { x: 0.5, y: 4, z: 4 },
      lethal: true,
    }];

    const result = selectGravityTarget({ ...baseInput, wells: [well], hazards });
    expect(result.well).toBeNull();
  });
});
