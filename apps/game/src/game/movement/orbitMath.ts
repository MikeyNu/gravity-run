import {
  add,
  cross,
  dot,
  length,
  normalize,
  reject,
  scale,
  subtract,
  type Vec3,
} from '@gravity-run/shared';

export interface OrbitBasis {
  radial: Vec3;
  tangent: Vec3;
  normal: Vec3;
  radius: number;
  tangentialSpeed: number;
  radialSpeed: number;
}

export interface OrbitStepInput {
  centre: Vec3;
  radial: Vec3;
  tangent: Vec3;
  normal: Vec3;
  radius: number;
  tangentialSpeed: number;
  sinTheta: number;
  cosTheta: number;
}

export interface OrbitStepResult {
  position: Vec3;
  velocity: Vec3;
  radial: Vec3;
  tangent: Vec3;
}

const BASIS_EPSILON = 1e-5;

export function buildOrbitBasis(
  playerPosition: Vec3,
  centre: Vec3,
  velocity: Vec3,
  fallbackNormal: Vec3,
): OrbitBasis {
  const offset = subtract(playerPosition, centre);
  const radius = Math.max(length(offset), BASIS_EPSILON);
  const radial = scale(offset, 1 / radius);

  let normalCandidate = cross(radial, velocity);
  if (length(normalCandidate) < BASIS_EPSILON) {
    normalCandidate = reject(fallbackNormal, radial);
  }
  if (length(normalCandidate) < BASIS_EPSILON) {
    normalCandidate = reject({ x: 0, y: 1, z: 0 }, radial);
  }
  if (length(normalCandidate) < BASIS_EPSILON) {
    normalCandidate = reject({ x: 1, y: 0, z: 0 }, radial);
  }

  const normal = normalize(normalCandidate);
  let tangent = normalize(cross(normal, radial));
  if (dot(tangent, velocity) < 0) {
    tangent = scale(tangent, -1);
  }

  return {
    radial,
    tangent,
    normal,
    radius,
    tangentialSpeed: dot(velocity, tangent),
    radialSpeed: dot(velocity, radial),
  };
}

export function stepConstrainedOrbit(input: OrbitStepInput): OrbitStepResult {
  const radial = normalize(
    add(scale(input.radial, input.cosTheta), scale(input.tangent, input.sinTheta)),
  );
  const tangent = normalize(cross(input.normal, radial));

  return {
    position: add(input.centre, scale(radial, input.radius)),
    velocity: scale(tangent, input.tangentialSpeed),
    radial,
    tangent,
  };
}

export function predictClosestApproach(
  origin: Vec3,
  velocity: Vec3,
  target: Vec3,
  horizonSeconds: number,
): { timeSeconds: number; distance: number } {
  const speedSquared = dot(velocity, velocity);
  if (speedSquared < BASIS_EPSILON) {
    return { timeSeconds: 0, distance: length(subtract(target, origin)) };
  }

  const toTarget = subtract(target, origin);
  const timeSeconds = Math.min(Math.max(dot(toTarget, velocity) / speedSquared, 0), horizonSeconds);
  const closestPoint = add(origin, scale(velocity, timeSeconds));
  return {
    timeSeconds,
    distance: length(subtract(target, closestPoint)),
  };
}
