import type { Vec3 } from '@gravity-run/shared';

export type GravityWellClass = 'standard' | 'accelerator' | 'precision' | 'recovery';
export type HazardKind = 'spire' | 'blade' | 'debris' | 'collapse-gate' | 'saw' | 'piston' | 'swinging-arm';

export type HazardMotion =
  | { kind: 'static' }
  | { kind: 'oscillate'; axis: 'x' | 'y' | 'z'; amplitude: number; period: number; phase: number }
  | { kind: 'rotate'; axis: 'x' | 'y' | 'z'; rpm: number; phase: number }
  | { kind: 'pendulum'; axis: 'x' | 'y' | 'z'; amplitude: number; period: number; phase: number };

export interface CourseGenerationConfig {
  moduleLength: number;
  activeModuleCount: number;
  preloadModuleCount: number;
  routeHalfWidth: number;
  minimumWellSpacing: number;
  collapseStartDistance: number;
  collapseBaseSpeed: number;
  collapseAccelerationPerMetre: number;
}

export interface GravityWellDefinition {
  id: string;
  moduleId: number;
  position: Vec3;
  routeDirection: Vec3;
  class: GravityWellClass;
  physicalRadius: number;
  minimumOrbitRadius: number;
  maximumOrbitRadius: number;
  acquisitionRadius: number;
  latchRadius: number;
  allowedApproachCosine: number;
  authoredPriority: number;
  maximumTangentialSpeed: number;
  orbitAcceleration: number;
  energyBudget: number;
  releaseBoost: number;
  risk: number;
}

export interface HazardDefinition {
  id: string;
  moduleId: number;
  kind: HazardKind;
  position: Vec3;
  halfExtents: Vec3;
  lethal: boolean;
  motion: HazardMotion;
}

export interface FragmentDefinition {
  id: string;
  moduleId: number;
  position: Vec3;
  radius: number;
  value: number;
}

export interface CourseModuleDefinition {
  id: number;
  archetype:
    | 'launch'
    | 'wide-orbit'
    | 'vertical-climb'
    | 'slalom'
    | 'precision-gate'
    | 'split-route'
    | 'debris-field'
    | 'recovery-bay';
  origin: Vec3;
  length: number;
  wells: GravityWellDefinition[];
  hazards: HazardDefinition[];
  fragments: FragmentDefinition[];
}

export const courseConfig: Readonly<CourseGenerationConfig> = Object.freeze({
  moduleLength: 46,
  activeModuleCount: 7,
  preloadModuleCount: 3,
  routeHalfWidth: 13,
  minimumWellSpacing: 8,
  collapseStartDistance: 34,
  collapseBaseSpeed: 8.5,
  collapseAccelerationPerMetre: 0.0038,
});
