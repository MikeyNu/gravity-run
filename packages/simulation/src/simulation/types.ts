import type {
  CourseModuleDefinition,
  FragmentDefinition,
  GravityWellDefinition,
  HazardDefinition,
} from '@gravity-run/game-config';
import type { ReplayHeader, Vec3 } from '@gravity-run/shared';
import type { ReleaseGrade } from '../scoring/ScoreSystem.js';

export type RunMode = ReplayHeader['mode'];

export interface RunConfiguration {
  seed: string;
  mode: RunMode;
  assisted?: boolean;
}

export type MovementPhase =
  | 'countdown'
  | 'free-flight'
  | 'latching'
  | 'orbiting'
  | 'released'
  | 'failed';

export type FailureReason = 'collision' | 'collapse' | 'fell' | 'stalled' | null;

export interface SimulationSnapshot {
  tick: number;
  elapsedSeconds: number;
  phase: MovementPhase;
  playerPosition: Vec3;
  playerVelocity: Vec3;
  playerSpeed: number;
  playerRadius: number;
  activeTargetId: string | null;
  previewTargetId: string | null;
  tetherLength: number | null;
  targetLocked: boolean;
  distance: number;
  score: number;
  combo: number;
  maximumCombo: number;
  fragments: number;
  nearMisses: number;
  lastReleaseGrade: ReleaseGrade | null;
  collapseX: number;
  failureReason: FailureReason;
  countdownTicks: number;
  checksum: string;
  modules: readonly CourseModuleDefinition[];
  wells: readonly GravityWellDefinition[];
  hazards: readonly HazardDefinition[];
  pickups: readonly FragmentDefinition[];
  collectedFragmentIds: readonly string[];
}
