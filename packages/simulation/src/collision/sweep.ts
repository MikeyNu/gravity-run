import type { HazardDefinition } from '@gravity-run/game-config';
import { add, clamp, dot, lengthSquared, scale, subtract, type Vec3 } from '@gravity-run/shared';

export interface SweepHit {
  hazard: HazardDefinition;
  time: number;
  point: Vec3;
}

function segmentAabbTime(start: Vec3, end: Vec3, minimum: Vec3, maximum: Vec3): number | null {
  const direction = subtract(end, start);
  let near = 0;
  let far = 1;

  for (const axis of ['x', 'y', 'z'] as const) {
    const origin = start[axis];
    const delta = direction[axis];
    if (Math.abs(delta) < 1e-8) {
      if (origin < minimum[axis] || origin > maximum[axis]) return null;
      continue;
    }
    let axisNear = (minimum[axis] - origin) / delta;
    let axisFar = (maximum[axis] - origin) / delta;
    if (axisNear > axisFar) [axisNear, axisFar] = [axisFar, axisNear];
    near = Math.max(near, axisNear);
    far = Math.min(far, axisFar);
    if (near > far) return null;
  }

  return near >= 0 && near <= 1 ? near : null;
}

export function sweepSphereAgainstHazards(
  start: Vec3,
  end: Vec3,
  radius: number,
  hazards: readonly HazardDefinition[],
): SweepHit | null {
  let nearest: SweepHit | null = null;
  for (const hazard of hazards) {
    const minimum = {
      x: hazard.position.x - hazard.halfExtents.x - radius,
      y: hazard.position.y - hazard.halfExtents.y - radius,
      z: hazard.position.z - hazard.halfExtents.z - radius,
    };
    const maximum = {
      x: hazard.position.x + hazard.halfExtents.x + radius,
      y: hazard.position.y + hazard.halfExtents.y + radius,
      z: hazard.position.z + hazard.halfExtents.z + radius,
    };
    const time = segmentAabbTime(start, end, minimum, maximum);
    if (time === null || (nearest && time >= nearest.time)) continue;
    nearest = { hazard, time, point: add(start, scale(subtract(end, start), time)) };
  }
  return nearest;
}

export function distanceSquaredToSegment(point: Vec3, start: Vec3, end: Vec3): number {
  const segment = subtract(end, start);
  const denominator = lengthSquared(segment);
  if (denominator <= Number.EPSILON) return lengthSquared(subtract(point, start));
  const t = clamp(dot(subtract(point, start), segment) / denominator, 0, 1);
  return lengthSquared(subtract(point, add(start, scale(segment, t))));
}
