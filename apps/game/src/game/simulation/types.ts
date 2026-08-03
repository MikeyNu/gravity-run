import type { Vec3 } from '@gravity-run/shared';

export type MovementPhase = 'free-flight' | 'latching' | 'orbiting' | 'released';

export interface SimulationSnapshot {
  tick: number;
  elapsedSeconds: number;
  phase: MovementPhase;
  playerPosition: Vec3;
  playerVelocity: Vec3;
  playerSpeed: number;
  wellPosition: Vec3;
  tetherLength: number | null;
  targetLocked: boolean;
}
