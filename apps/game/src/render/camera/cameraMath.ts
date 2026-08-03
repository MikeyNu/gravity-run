import * as THREE from 'three';

const MIN_ASPECT = 0.25;
const MAX_ASPECT = 8;

export function verticalFovFromHorizontal(horizontalDegrees: number, aspect: number): number {
  const safeAspect = THREE.MathUtils.clamp(aspect, MIN_ASPECT, MAX_ASPECT);
  const horizontalRadians = THREE.MathUtils.degToRad(
    THREE.MathUtils.clamp(horizontalDegrees, 1, 179),
  );
  return THREE.MathUtils.radToDeg(
    2 * Math.atan(Math.tan(horizontalRadians * 0.5) / safeAspect),
  );
}

export interface SpringState {
  value: number;
  velocity: number;
}

export function stepCriticallyDampedSpring(
  state: SpringState,
  target: number,
  smoothTimeSeconds: number,
  deltaSeconds: number,
): SpringState {
  const smoothTime = Math.max(smoothTimeSeconds, 1e-4);
  const delta = THREE.MathUtils.clamp(deltaSeconds, 0, 0.1);
  const omega = 2 / smoothTime;
  const x = omega * delta;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const displacement = state.value - target;
  const temporary = (state.velocity + omega * displacement) * delta;

  return {
    value: target + (displacement + temporary) * decay,
    velocity: (state.velocity - omega * temporary) * decay,
  };
}

export function stepCriticallyDampedVector(
  current: THREE.Vector3,
  velocity: THREE.Vector3,
  target: THREE.Vector3,
  smoothTimeSeconds: number,
  deltaSeconds: number,
): void {
  const x = stepCriticallyDampedSpring(
    { value: current.x, velocity: velocity.x },
    target.x,
    smoothTimeSeconds,
    deltaSeconds,
  );
  const y = stepCriticallyDampedSpring(
    { value: current.y, velocity: velocity.y },
    target.y,
    smoothTimeSeconds,
    deltaSeconds,
  );
  const z = stepCriticallyDampedSpring(
    { value: current.z, velocity: velocity.z },
    target.z,
    smoothTimeSeconds,
    deltaSeconds,
  );
  current.set(x.value, y.value, z.value);
  velocity.set(x.velocity, y.velocity, z.velocity);
}
