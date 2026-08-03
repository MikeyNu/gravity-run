export type QualityTier = 'compatibility' | 'mobile' | 'desktop' | 'cinematic';

export function detectQualityTier(): QualityTier {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const memory = navigator.deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;

  if (memory <= 2 || cores <= 4) return 'compatibility';
  if (coarsePointer || reducedMotion || memory <= 6) return 'mobile';
  if (memory >= 12 && cores >= 10) return 'cinematic';
  return 'desktop';
}
