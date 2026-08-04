import type { GravityWellDefinition } from '@gravity-run/game-config';

export interface ReachabilityConfig {
  maximumSpeed: number;
  minimumSpeed: number;
  maximumOrbitSpeed: number;
  linearDrag: number;
}

function maxFreeFlightRange(releaseSpeed: number, minimumSpeed: number, linearDrag: number): number {
  if (linearDrag <= 0 || releaseSpeed <= minimumSpeed) return 0;
  const d = linearDrag / 60;
  const decay = 1 - d;
  const tStall = Math.log(minimumSpeed / releaseSpeed) / Math.log(decay);
  if (tStall <= 0) return 0;
  return (releaseSpeed / 60) * ((1 - Math.pow(decay, tStall)) / d);
}

export function isConservativelyReachable(
  from: GravityWellDefinition,
  to: GravityWellDefinition,
  config: ReachabilityConfig,
): boolean {
  const releaseSpeed = Math.min(
    Math.min(from.maximumTangentialSpeed, config.maximumOrbitSpeed) + from.releaseBoost,
    config.maximumSpeed,
  );
  const dx = to.position.x - from.position.x;
  const dy = to.position.y - from.position.y;
  const dz = to.position.z - from.position.z;
  const centreDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const travelRequired = Math.max(centreDistance - from.minimumOrbitRadius - to.acquisitionRadius, 0);
  return maxFreeFlightRange(releaseSpeed, config.minimumSpeed, config.linearDrag) >= travelRequired;
}
