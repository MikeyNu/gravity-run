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
  radialSpeed: number;
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
const TAU = Math.PI * 2;

export function deterministicSinCos(angle: number): { sin: number; cos: number } {
  let x = angle % TAU;
  if (x > Math.PI) x -= TAU;
  else if (x < -Math.PI) x += TAU;

  const x2 = x * x;
  const sin = x * (1 + x2 * (-1 / 6 + x2 * (1 / 120 + x2 * (-1 / 5040 + x2 / 362880))));
  const cos = 1 + x2 * (-1 / 2 + x2 * (1 / 24 + x2 * (-1 / 720 + x2 / 40320)));
  const magnitude = Math.sqrt(sin * sin + cos * cos);
  if (magnitude <= Number.EPSILON) return { sin: 0, cos: 1 };
  return { sin: sin / magnitude, cos: cos / magnitude };
}

export function buildOrbitBasis(
  playerPosition: Vec3,
  centre: Vec3,
  velocity: Vec3,
  routeDirection: Vec3,
): OrbitBasis {
  const offset = subtract(playerPosition, centre);
  const radius = Math.max(length(offset), BASIS_EPSILON);
  const radial = scale(offset, 1 / radius);

  let normalCandidate = cross(radial, velocity);
  if (length(normalCandidate) < BASIS_EPSILON) {
    normalCandidate = cross(radial, routeDirection);
  }
  if (length(normalCandidate) < BASIS_EPSILON) {
    normalCandidate = reject({ x: 0, y: 1, z: 0 }, radial);
  }
  if (length(normalCandidate) < BASIS_EPSILON) {
    normalCandidate = reject({ x: 1, y: 0, z: 0 }, radial);
  }

  let normal = normalize(normalCandidate);
  let tangent = normalize(cross(normal, radial));
  if (dot(tangent, velocity) < 0) {
    normal = scale(normal, -1);
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
    velocity: add(
      scale(tangent, input.tangentialSpeed),
      scale(radial, input.radialSpeed),
    ),
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
