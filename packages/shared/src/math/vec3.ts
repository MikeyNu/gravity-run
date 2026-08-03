export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function cloneVec3(value: Vec3): Vec3 {
  return { x: value.x, y: value.y, z: value.z };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(value: Vec3, scalar: number): Vec3 {
  return { x: value.x * scalar, y: value.y * scalar, z: value.z * scalar };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function lengthSquared(value: Vec3): number {
  return dot(value, value);
}

export function length(value: Vec3): number {
  return Math.sqrt(lengthSquared(value));
}

export function distance(a: Vec3, b: Vec3): number {
  return length(subtract(a, b));
}

export function normalize(value: Vec3): Vec3 {
  const magnitude = length(value);
  if (magnitude <= Number.EPSILON) return vec3();
  return scale(value, 1 / magnitude);
}

export function reject(value: Vec3, normal: Vec3): Vec3 {
  const denominator = lengthSquared(normal);
  if (denominator <= Number.EPSILON) return cloneVec3(value);
  return subtract(value, scale(normal, dot(value, normal) / denominator));
}

export function lerpVec3(a: Vec3, b: Vec3, alpha: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * alpha,
    y: a.y + (b.y - a.y) * alpha,
    z: a.z + (b.z - a.z) * alpha,
  };
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function project(value: Vec3, normal: Vec3): Vec3 {
  const denominator = lengthSquared(normal);
  if (denominator <= Number.EPSILON) return vec3();
  return scale(normal, dot(value, normal) / denominator);
}

export function negate(value: Vec3): Vec3 {
  return scale(value, -1);
}
