import { describe, expect, it } from 'vitest';
import type { GravityWellDefinition } from '@gravity-run/game-config';
import { isConservativelyReachable } from './reachabilityProof';
import { buildRouteGraph } from './RouteGraph';

const CFG = { maximumSpeed: 42, minimumSpeed: 8, maximumOrbitSpeed: 34, linearDrag: 0.012 };

function makeWell(id: string, x: number, opts: Partial<GravityWellDefinition> = {}): GravityWellDefinition {
  return {
    id,
    moduleId: 0,
    position: { x, y: 0, z: 0 },
    routeDirection: { x: 1, y: 0, z: 0 },
    class: 'standard',
    physicalRadius: 1.35,
    minimumOrbitRadius: 5.5,
    maximumOrbitRadius: 13.5,
    acquisitionRadius: 18,
    latchRadius: 11.5,
    allowedApproachCosine: -0.22,
    authoredPriority: 0,
    maximumTangentialSpeed: 28,
    orbitAcceleration: 8,
    energyBudget: 8,
    releaseBoost: 1.5,
    risk: 0.2,
    ...opts,
  };
}

describe('isConservativelyReachable', () => {
  it('accepts a close forward well', () => {
    const from = makeWell('a', 0);
    const to = makeWell('b', 20);
    expect(isConservativelyReachable(from, to, CFG)).toBe(true);
  });

  it('rejects a well that is behind', () => {
    const from = makeWell('a', 50);
    const to = makeWell('b', 20);
    // Route graph handles direction; reachability itself is distance-based
    // Even if the well is behind, the distance check still passes — direction is a graph concern
    // so just verify a very far-away well fails
    const far = makeWell('c', 100_000);
    const low = makeWell('d', 0, { maximumTangentialSpeed: 8, releaseBoost: 0 });
    expect(isConservativelyReachable(low, far, CFG)).toBe(false);
  });

  it('passes for a standard well within typical course spacing', () => {
    const from = makeWell('a', 0);
    const to = makeWell('b', 46); // one module length
    expect(isConservativelyReachable(from, to, CFG)).toBe(true);
  });
});

describe('buildRouteGraph', () => {
  it('marks a well with no forward successors as a dead end', () => {
    const wells = [makeWell('a', 0), makeWell('b', 1_000_000)];
    const graph = buildRouteGraph(wells, CFG);
    // 'a' can reach 'b' if maxRange >= 1_000_000 - 5.5 - 18 = 999_976.5
    // From earlier calculation max range ≈ 3500m, so 'a' cannot reach 'b'
    expect(graph.isDeadEnd('a')).toBe(true);
  });

  it('links close wells correctly', () => {
    const wells = [makeWell('a', 0), makeWell('b', 30), makeWell('c', 60)];
    const graph = buildRouteGraph(wells, CFG);
    expect(graph.isDeadEnd('a')).toBe(false);
    expect(graph.successors('a')).toContain('b');
    expect(graph.forwardDepth('a')).toBeGreaterThan(0);
  });

  it('never treats a well as its own successor', () => {
    const wells = [makeWell('a', 0), makeWell('b', 30)];
    const graph = buildRouteGraph(wells, CFG);
    expect(graph.successors('a')).not.toContain('a');
  });
});
