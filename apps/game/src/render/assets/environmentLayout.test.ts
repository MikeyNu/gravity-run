import { describe, expect, it } from 'vitest';
import { generateCourseWindow } from '@gravity-run/simulation';
import { buildEnvironmentPlacements, placementClearsGameplayRoute } from './environmentLayout';

describe('environment layout', () => {
  it('is deterministic for the same authored course window', () => {
    const modules = generateCourseWindow('environment-layout', 0, 9);
    expect(buildEnvironmentPlacements(modules)).toEqual(buildEnvironmentPlacements(modules));
  });

  it('keeps decorative architecture outside the playable route volume', () => {
    for (let firstModule = 0; firstModule < 80; firstModule += 8) {
      const placements = buildEnvironmentPlacements(
        generateCourseWindow('environment-clearance', firstModule, 8),
      );
      expect(placements.every(placementClearsGameplayRoute)).toBe(true);
    }
  });

  it('keeps per-module instance counts bounded for mobile streaming', () => {
    const modules = generateCourseWindow('environment-budget', 0, 12);
    const placements = buildEnvironmentPlacements(modules);
    const counts = new Map<number, number>();
    for (const placement of placements) {
      counts.set(placement.moduleId, (counts.get(placement.moduleId) ?? 0) + 1);
    }
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(17);
    expect(placements.length).toBeGreaterThan(modules.length * 6);
  });
});
