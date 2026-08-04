import type { GravityWellDefinition } from '@gravity-run/game-config';
import { distance, dot, normalize, subtract, type Vec3 } from '@gravity-run/shared';

export interface TargetSelectionInput {
  playerPosition: Vec3;
  playerVelocity: Vec3;
  currentTargetId: string | null;
  wells: readonly GravityWellDefinition[];
  recentlyUsed: ReadonlySet<string>;
}

export interface TargetSelectionResult {
  well: GravityWellDefinition | null;
  score: number;
}

export function selectGravityTarget(input: TargetSelectionInput): TargetSelectionResult {
  const forward = normalize(input.playerVelocity);
  let best: GravityWellDefinition | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const well of input.wells) {
    const offset = subtract(well.position, input.playerPosition);
    const range = distance(input.playerPosition, well.position);
    if (range > well.acquisitionRadius) continue;

    const direction = normalize(offset);
    const alignment = dot(direction, forward);
    if (alignment < -0.42 && well.class !== 'recovery') continue;

    const normalizedDistance = 1 - range / well.acquisitionRadius;
    const routeCompatibility = dot(normalize(well.routeDirection), forward);
    let score = alignment * 2.1 + normalizedDistance * 1.6 + routeCompatibility * 0.55 + well.risk * 0.12;

    if (well.id === input.currentTargetId) score += 0.42;
    if (input.recentlyUsed.has(well.id)) score -= 1.15;
    if (well.class === 'recovery') score += input.playerPosition.y < -7 ? 0.9 : -0.15;

    if (score > bestScore) {
      best = well;
      bestScore = score;
    }
  }

  return { well: best, score: bestScore };
}
