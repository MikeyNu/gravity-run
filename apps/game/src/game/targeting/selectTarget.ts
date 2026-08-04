import type { GravityWellDefinition, HazardDefinition } from '@gravity-run/game-config';
import { distance, dot, normalize, subtract, type Vec3 } from '@gravity-run/shared';
import { sweepSphereAgainstHazards } from '../collision/sweep';

export interface TargetSelectionInput {
  playerPosition: Vec3;
  playerVelocity: Vec3;
  currentTargetId: string | null;
  wells: readonly GravityWellDefinition[];
  hazards: readonly HazardDefinition[];
  recentlyUsed: ReadonlySet<string>;
  excludedWellIds: ReadonlySet<string>;
  playerRadius: number;
  recoveryBias?: number;
}

export interface TargetSelectionResult {
  well: GravityWellDefinition | null;
  score: number;
}

export function selectGravityTarget(input: TargetSelectionInput): TargetSelectionResult {
  const forward = normalize(input.playerVelocity);
  const bias = input.recoveryBias ?? 0;
  const recoveryApproachCosine = bias > 0.35 ? -1 : -0.65;
  let best: GravityWellDefinition | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const well of input.wells) {
    if (input.excludedWellIds.has(well.id)) continue;

    const offset = subtract(well.position, input.playerPosition);
    const range = distance(input.playerPosition, well.position);
    if (range > well.acquisitionRadius) continue;

    const direction = normalize(offset);
    const alignment = dot(direction, forward);
    const approachThreshold = well.class === 'recovery' ? recoveryApproachCosine : well.allowedApproachCosine;
    if (alignment < approachThreshold) continue;

    const obstruction = sweepSphereAgainstHazards(
      input.playerPosition,
      well.position,
      input.playerRadius,
      input.hazards,
    );
    if (obstruction?.hazard.lethal) continue;

    const normalizedDistance = 1 - range / well.acquisitionRadius;
    const routeCompatibility = dot(normalize(well.routeDirection), forward);
    let score =
      alignment * 2.1 +
      normalizedDistance * 1.6 +
      routeCompatibility * 0.55 +
      well.risk * 0.12 +
      well.authoredPriority;

    if (well.id === input.currentTargetId) score += 0.42;
    if (well.class === 'recovery') {
      const posBonus = input.playerPosition.y < -7 ? 0.9 : -0.15;
      score += posBonus + bias * 2.2;
      if (input.recentlyUsed.has(well.id) && bias < 0.4) score -= 1.15;
    } else {
      if (input.recentlyUsed.has(well.id)) score -= 1.15;
    }

    if (score > bestScore) {
      best = well;
      bestScore = score;
    }
  }

  return { well: best, score: bestScore };
}
