import { describe, expect, it } from 'vitest';
import { generateCourseWindow } from '../procedural/courseGenerator';
import { selectGravityTarget } from './selectTarget';

describe('target selection', () => {
  it('chooses a reachable forward well', () => {
    const wells = generateCourseWindow('targeting', 0, 2).flatMap((module) => module.wells);
    const result = selectGravityTarget({
      playerPosition: { x: 4, y: 1, z: 0 },
      playerVelocity: { x: 12, y: 0, z: 0 },
      currentTargetId: null,
      wells,
      recentlyUsed: new Set(),
    });
    expect(result.well).not.toBeNull();
    expect(result.well?.position.x).toBeGreaterThan(4);
  });
});
