import { describe, expect, it } from 'vitest';
import { generateCourseModule, generateCourseWindow } from './courseGenerator';

describe('course generation', () => {
  it('is deterministic for the same seed and module id', () => {
    expect(generateCourseModule('test-seed', 12)).toEqual(generateCourseModule('test-seed', 12));
  });

  it('creates a connected forward window with gameplay content', () => {
    const modules = generateCourseWindow('window', 0, 12);
    expect(modules).toHaveLength(12);
    expect(modules[0]?.archetype).toBe('launch');
    expect(modules.every((module, index) => module.origin.x === index * module.length)).toBe(true);
    expect(modules.flatMap((module) => module.wells).length).toBeGreaterThan(12);
  });
});
