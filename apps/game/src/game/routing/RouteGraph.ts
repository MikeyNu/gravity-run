import type { GravityWellDefinition } from '@gravity-run/game-config';
import { isConservativelyReachable, type ReachabilityConfig } from './reachabilityProof';

export interface RouteGraph {
  successors(wellId: string): readonly string[];
  isDeadEnd(wellId: string): boolean;
  forwardDepth(wellId: string, lookahead?: number): number;
}

export function buildRouteGraph(
  wells: readonly GravityWellDefinition[],
  config: ReachabilityConfig,
): RouteGraph {
  const successorMap = new Map<string, string[]>();
  for (const w of wells) successorMap.set(w.id, []);

  for (const from of wells) {
    for (const to of wells) {
      if (to.position.x <= from.position.x + 0.5) continue;
      if (!isConservativelyReachable(from, to, config)) continue;
      successorMap.get(from.id)!.push(to.id);
    }
  }

  const depthCache = new Map<string, number>();

  function depth(id: string, visited: Set<string>, limit: number): number {
    if (limit <= 0) return limit;
    if (depthCache.has(id)) return depthCache.get(id)!;
    if (visited.has(id)) return 0;
    visited.add(id);
    const children = successorMap.get(id) ?? [];
    let best = 0;
    for (const child of children) {
      best = Math.max(best, depth(child, visited, limit - 1) + 1);
    }
    visited.delete(id);
    depthCache.set(id, best);
    return best;
  }

  return {
    successors(wellId) { return successorMap.get(wellId) ?? []; },
    isDeadEnd(wellId) { return (successorMap.get(wellId)?.length ?? 0) === 0; },
    forwardDepth(wellId, lookahead = 4) {
      return depth(wellId, new Set(), lookahead);
    },
  };
}
