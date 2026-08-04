import type { CourseModuleDefinition } from '@gravity-run/game-config';
import type { Vec3 } from '@gravity-run/shared';

export type EnvironmentAssetKind =
  | 'tower-a'
  | 'tower-b'
  | 'tower-broken'
  | 'bridge-straight'
  | 'platform-wide'
  | 'truss-support'
  | 'antenna-cluster'
  | 'debris-chunk-large'
  | 'far-cluster';

export interface EnvironmentPlacement {
  id: string;
  moduleId: number;
  kind: EnvironmentAssetKind;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  animation: 'static' | 'drift' | 'signal';
}

const SAFE_ROUTE_HALF_WIDTH = 14;
const MINIMUM_ROUTE_CLEARANCE = 17;

function hash32(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function randomSequence(seed: string): () => number {
  let state = hash32(seed) || 1;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function placement(
  module: CourseModuleDefinition,
  slot: string,
  kind: EnvironmentAssetKind,
  position: Vec3,
  rotation: Vec3 = { x: 0, y: 0, z: 0 },
  scale: Vec3 = { x: 1, y: 1, z: 1 },
  animation: EnvironmentPlacement['animation'] = 'static',
): EnvironmentPlacement {
  return {
    id: `environment-m${module.id}-${slot}`,
    moduleId: module.id,
    kind,
    position,
    rotation,
    scale,
    animation,
  };
}

function modulePlacements(module: CourseModuleDefinition): EnvironmentPlacement[] {
  const random = randomSequence(`${module.id}:${module.archetype}`);
  const originX = module.origin.x;
  const side = random() < 0.5 ? -1 : 1;
  const yaw = () => (random() - 0.5) * 0.34;
  const lean = () => (random() - 0.5) * 0.08;
  const result: EnvironmentPlacement[] = [];

  result.push(
    placement(
      module,
      'tower-near-a',
      module.id % 3 === 0 ? 'tower-b' : 'tower-a',
      {
        x: originX + 7 + random() * 7,
        y: 4 + random() * 8,
        z: side * (MINIMUM_ROUTE_CLEARANCE + 5 + random() * 8),
      },
      { x: lean(), y: yaw(), z: lean() },
      { x: 0.86 + random() * 0.24, y: 0.82 + random() * 0.32, z: 0.86 + random() * 0.24 },
    ),
    placement(
      module,
      'tower-near-b',
      module.id % 4 === 0 ? 'tower-broken' : 'tower-b',
      {
        x: originX + 29 + random() * 9,
        y: 7 + random() * 11,
        z: -side * (MINIMUM_ROUTE_CLEARANCE + 7 + random() * 11),
      },
      { x: lean(), y: yaw(), z: lean() },
      { x: 0.76 + random() * 0.3, y: 0.78 + random() * 0.36, z: 0.76 + random() * 0.3 },
    ),
  );

  result.push(
    placement(
      module,
      'platform-under-route',
      'platform-wide',
      { x: originX + module.length * 0.5, y: -11.4, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 1.32, y: 0.72, z: 1.14 },
    ),
    placement(
      module,
      'truss-under-route',
      'truss-support',
      { x: originX + module.length * 0.5, y: -17.2, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 1.18, y: 1, z: 1.15 },
    ),
  );

  if (module.id % 2 === 0) {
    result.push(
      placement(
        module,
        'far-cluster-primary',
        'far-cluster',
        { x: originX + 18 + random() * 14, y: 8 + random() * 18, z: side * (68 + random() * 22) },
        { x: lean(), y: yaw(), z: lean() },
        { x: 0.9 + random() * 0.3, y: 0.9 + random() * 0.34, z: 0.9 + random() * 0.3 },
      ),
      placement(
        module,
        'far-cluster-secondary',
        'far-cluster',
        { x: originX + 4 + random() * 34, y: 12 + random() * 18, z: -side * (82 + random() * 24) },
        { x: lean(), y: yaw(), z: lean() },
        { x: 0.72 + random() * 0.26, y: 0.75 + random() * 0.28, z: 0.72 + random() * 0.26 },
      ),
    );
  }

  if (module.archetype === 'vertical-climb' || module.archetype === 'split-route') {
    result.push(
      placement(
        module,
        'landmark-broken',
        'tower-broken',
        { x: originX + 25, y: 8, z: -side * 19.5 },
        { x: 0.08 * side, y: yaw(), z: 0.12 * -side },
        { x: 1.05, y: 1.08, z: 1.05 },
      ),
    );
  }

  if (module.archetype === 'precision-gate') {
    result.push(
      placement(
        module,
        'bridge-overhead',
        'bridge-straight',
        { x: originX + 28, y: 18.5, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 1.08, y: 0.82, z: 1.36 },
      ),
    );
  }

  if (module.archetype === 'recovery-bay') {
    result.push(
      placement(
        module,
        'recovery-platform',
        'platform-wide',
        { x: originX + 27, y: -7.8, z: -side * 7.5 },
        { x: 0, y: side * 0.08, z: 0 },
        { x: 1.08, y: 0.8, z: 0.9 },
      ),
    );
  }

  const antennaCount = module.id % 3 === 0 ? 2 : 1;
  for (let index = 0; index < antennaCount; index += 1) {
    result.push(
      placement(
        module,
        `antenna-${index}`,
        'antenna-cluster',
        {
          x: originX + 10 + index * 23 + random() * 5,
          y: 29 + random() * 12,
          z: (index === 0 ? side : -side) * (MINIMUM_ROUTE_CLEARANCE + 8 + random() * 8),
        },
        { x: 0, y: yaw(), z: 0 },
        { x: 0.8 + random() * 0.25, y: 0.9 + random() * 0.2, z: 0.8 + random() * 0.25 },
        'signal',
      ),
    );
  }

  const debrisCount = module.archetype === 'debris-field' ? 7 : module.id % 2 === 0 ? 3 : 2;
  for (let index = 0; index < debrisCount; index += 1) {
    const debrisSide = index % 2 === 0 ? side : -side;
    result.push(
      placement(
        module,
        `debris-${index}`,
        'debris-chunk-large',
        {
          x: originX + 5 + random() * (module.length - 10),
          y: -2 + random() * 25,
          z: debrisSide * (MINIMUM_ROUTE_CLEARANCE + 3 + random() * 25),
        },
        { x: random() * Math.PI, y: random() * Math.PI, z: random() * Math.PI },
        { x: 0.36 + random() * 0.62, y: 0.36 + random() * 0.62, z: 0.36 + random() * 0.62 },
        'drift',
      ),
    );
  }

  return result;
}

export function buildEnvironmentPlacements(
  modules: readonly CourseModuleDefinition[],
): EnvironmentPlacement[] {
  return modules.flatMap(modulePlacements);
}

export function placementClearsGameplayRoute(value: EnvironmentPlacement): boolean {
  if (value.kind === 'platform-wide' || value.kind === 'truss-support') {
    return value.position.y <= -7.5;
  }
  if (value.kind === 'bridge-straight') return value.position.y >= 17;
  return Math.abs(value.position.z) >= SAFE_ROUTE_HALF_WIDTH;
}
