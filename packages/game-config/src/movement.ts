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
  minimumSpeed: number;
  freeFlightAcceleration: Vec3;
  linearDrag: number;
  playerRadius: number;
  collisionSkin: number;
  latchBufferTicks: number;
  releaseCoyoteTicks: number;
  radialReleaseRetention: number;
  releasedWellRearmDistance: number;
  nearMissPadding: number;
  failureFloorY: number;
}

export const movementConfig: Readonly<MovementConfig> = Object.freeze({
  simulationHz: 60,
  maxCatchUpSteps: 4,
  acquisitionRadius: 18,
  latchBlendSeconds: 0.08,
  minimumOrbitSpeed: 11,
  maximumOrbitSpeed: 34,
  orbitAcceleration: 8.6,
  releaseBoost: 1.8,
  releaseStateTicks: 9,
  maximumSpeed: 42,
  minimumSpeed: 8,
  freeFlightAcceleration: { x: 0, y: -2.35, z: 0 },
  linearDrag: 0.012,
  playerRadius: 0.34,
  collisionSkin: 0.035,
  latchBufferTicks: 7,
  releaseCoyoteTicks: 4,
  radialReleaseRetention: 0.28,
  releasedWellRearmDistance: 5,
  nearMissPadding: 0.9,
  failureFloorY: -22,
});
