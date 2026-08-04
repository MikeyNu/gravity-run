import {
  courseConfig,
  type CourseModuleDefinition,
  type FragmentDefinition,
  type GravityWellClass,
  type GravityWellDefinition,
  type HazardDefinition,
} from '@gravity-run/game-config';
import { Xoshiro128StarStar, type RandomState, type Vec3 } from '@gravity-run/shared';

const ARCHETYPES: CourseModuleDefinition['archetype'][] = [
  'wide-orbit',
  'vertical-climb',
  'slalom',
  'precision-gate',
  'split-route',
  'debris-field',
  'recovery-bay',
];

function mix32(value: number): number {
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

export function seedFromString(seed: string): RandomState {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return {
    s0: mix32(hash ^ 0xa341316c) || 1,
    s1: mix32(hash ^ 0xc8013ea4) || 2,
    s2: mix32(hash ^ 0xad90777d) || 3,
    s3: mix32(hash ^ 0x7e95761e) || 4,
  };
}

function randomRange(random: Xoshiro128StarStar, minimum: number, maximum: number): number {
  return minimum + (maximum - minimum) * random.nextFloat();
}

function well(
  moduleId: number,
  slot: number,
  position: Vec3,
  routeDirection: Vec3,
  className: GravityWellClass,
  risk: number,
): GravityWellDefinition {
  const classTuning = {
    standard: { orbit: 28, acceleration: 8, energy: 8, boost: 1.5, acquire: 18 },
    accelerator: { orbit: 36, acceleration: 12, energy: 12, boost: 2.7, acquire: 19 },
    precision: { orbit: 30, acceleration: 7, energy: 6, boost: 1.9, acquire: 16 },
    recovery: { orbit: 23, acceleration: 6, energy: 5, boost: 1.1, acquire: 22 },
  }[className];

  return {
    id: `m${moduleId}-well-${slot}`,
    moduleId,
    position,
    routeDirection,
    class: className,
    physicalRadius: className === 'accelerator' ? 1.7 : 1.35,
    minimumOrbitRadius: className === 'precision' ? 4.7 : 5.5,
    maximumOrbitRadius: className === 'recovery' ? 16 : 13.5,
    acquisitionRadius: classTuning.acquire,
    maximumTangentialSpeed: classTuning.orbit,
    orbitAcceleration: classTuning.acceleration,
    energyBudget: classTuning.energy,
    releaseBoost: classTuning.boost,
    risk,
  };
}

function hazard(
  moduleId: number,
  slot: number,
  kind: HazardDefinition['kind'],
  position: Vec3,
  halfExtents: Vec3,
  lethal = true,
): HazardDefinition {
  return { id: `m${moduleId}-hazard-${slot}`, moduleId, kind, position, halfExtents, lethal };
}

function fragment(moduleId: number, slot: number, position: Vec3): FragmentDefinition {
  return { id: `m${moduleId}-fragment-${slot}`, moduleId, position, radius: 0.55, value: 1 };
}

export function generateCourseModule(seed: string, moduleId: number): CourseModuleDefinition {
  const random = new Xoshiro128StarStar(seedFromString(`${seed}:${moduleId}`));
  const length = courseConfig.moduleLength;
  const origin = { x: moduleId * length, y: 0, z: 0 };
  const archetype = moduleId === 0 ? 'launch' : ARCHETYPES[Math.floor(random.nextFloat() * ARCHETYPES.length)] ?? 'wide-orbit';
  const wells: GravityWellDefinition[] = [];
  const hazards: HazardDefinition[] = [];
  const fragments: FragmentDefinition[] = [];
  const x = (local: number) => origin.x + local;

  if (archetype === 'launch') {
    wells.push(well(moduleId, 0, { x: x(20), y: 0, z: 0 }, { x: 1, y: 0.08, z: 0 }, 'standard', 0.2));
    fragments.push(fragment(moduleId, 0, { x: x(31), y: 2.6, z: 0 }));
  }

  if (archetype === 'wide-orbit') {
    const side = random.nextFloat() < 0.5 ? -1 : 1;
    wells.push(well(moduleId, 0, { x: x(15), y: randomRange(random, -1, 2), z: side * 5.5 }, { x: 1, y: 0.06, z: -side * 0.14 }, 'standard', 0.35));
    wells.push(well(moduleId, 1, { x: x(36), y: randomRange(random, 1, 4), z: -side * 4.2 }, { x: 1, y: 0.08, z: side * 0.1 }, 'accelerator', 0.55));
    fragments.push(fragment(moduleId, 0, { x: x(27), y: 5, z: 0 }));
  }

  if (archetype === 'vertical-climb') {
    wells.push(well(moduleId, 0, { x: x(13), y: -1, z: -3 }, { x: 0.9, y: 0.35, z: 0 }, 'standard', 0.35));
    wells.push(well(moduleId, 1, { x: x(30), y: 8, z: 3 }, { x: 0.94, y: -0.15, z: 0 }, 'accelerator', 0.65));
    hazards.push(hazard(moduleId, 0, 'spire', { x: x(25), y: 1.2, z: 0 }, { x: 1.2, y: 5.5, z: 1.2 }));
    fragments.push(fragment(moduleId, 0, { x: x(23), y: 8.8, z: 0 }));
  }

  if (archetype === 'slalom') {
    for (let index = 0; index < 3; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      wells.push(well(moduleId, index, { x: x(10 + index * 13), y: index * 0.8, z: side * 5.5 }, { x: 1, y: 0.03, z: -side * 0.12 }, index === 2 ? 'accelerator' : 'standard', 0.45 + index * 0.1));
    }
    fragments.push(fragment(moduleId, 0, { x: x(29), y: 3.8, z: 0 }));
  }

  if (archetype === 'precision-gate') {
    wells.push(well(moduleId, 0, { x: x(12), y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 'precision', 0.7));
    hazards.push(hazard(moduleId, 0, 'collapse-gate', { x: x(28), y: 5.3, z: 0 }, { x: 1.2, y: 3.8, z: 6.5 }));
    hazards.push(hazard(moduleId, 1, 'collapse-gate', { x: x(28), y: -5.3, z: 0 }, { x: 1.2, y: 3.8, z: 6.5 }));
    fragments.push(fragment(moduleId, 0, { x: x(29), y: 0, z: 0 }));
    wells.push(well(moduleId, 1, { x: x(39), y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 'accelerator', 0.8));
  }

  if (archetype === 'split-route') {
    wells.push(well(moduleId, 0, { x: x(13), y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 'standard', 0.3));
    wells.push(well(moduleId, 1, { x: x(32), y: 5.5, z: -6 }, { x: 1, y: -0.08, z: 0.08 }, 'precision', 0.9));
    wells.push(well(moduleId, 2, { x: x(32), y: -2.5, z: 7 }, { x: 1, y: 0.06, z: -0.08 }, 'recovery', 0.25));
    hazards.push(hazard(moduleId, 0, 'spire', { x: x(29), y: 1, z: 0 }, { x: 1.4, y: 6, z: 1.4 }));
  }

  if (archetype === 'debris-field') {
    wells.push(well(moduleId, 0, { x: x(11), y: 2, z: -4 }, { x: 1, y: 0, z: 0.08 }, 'accelerator', 0.65));
    wells.push(well(moduleId, 1, { x: x(38), y: -1, z: 4 }, { x: 1, y: 0.06, z: -0.05 }, 'standard', 0.5));
    for (let index = 0; index < 7; index += 1) {
      hazards.push(hazard(moduleId, index, 'debris', { x: x(18 + randomRange(random, 0, 16)), y: randomRange(random, -5, 7), z: randomRange(random, -8, 8) }, { x: randomRange(random, 0.55, 1.5), y: randomRange(random, 0.55, 1.5), z: randomRange(random, 0.55, 1.5) }));
    }
  }

  if (archetype === 'recovery-bay') {
    wells.push(well(moduleId, 0, { x: x(14), y: -4, z: 0 }, { x: 1, y: 0.18, z: 0 }, 'recovery', 0.15));
    wells.push(well(moduleId, 1, { x: x(35), y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 'standard', 0.3));
    fragments.push(fragment(moduleId, 0, { x: x(25), y: 1.5, z: -2.5 }));
    fragments.push(fragment(moduleId, 1, { x: x(28), y: 2.6, z: 2.5 }));
  }

  return { id: moduleId, archetype, origin, length, wells, hazards, fragments };
}

export function generateCourseWindow(seed: string, firstModule: number, count: number): CourseModuleDefinition[] {
  return Array.from({ length: count }, (_, offset) => generateCourseModule(seed, firstModule + offset));
}
