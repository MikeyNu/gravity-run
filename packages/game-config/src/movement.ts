import type { Vec3 } from '@gravity-run/shared';

export interface MovementConfig {
  simulationHz: number;
  maxCatchUpSteps: number;
  acquisitionRadius: number;
  latchBlendSeconds: number;
  minimumOrbitSpeed: number;
  maximumOrbitSpeed: number;
  orbitAcceleration: number;
  releaseBoost: number;
  releaseStateTicks: number;
  maximumSpeed: number;
  freeFlightAcceleration: Vec3;
}

export const movementConfig: Readonly<MovementConfig> = Object.freeze({
  simulationHz: 60,
  maxCatchUpSteps: 4,
  acquisitionRadius: 8.5,
  latchBlendSeconds: 0.1,
  minimumOrbitSpeed: 7.5,
  maximumOrbitSpeed: 19,
  orbitAcceleration: 7.2,
  releaseBoost: 1.4,
  releaseStateTicks: 10,
  maximumSpeed: 23,
  freeFlightAcceleration: { x: 0, y: -1.5, z: 0 },
});
