export interface QualityProfile {
  renderScaleMin: number;
  renderScaleMax: number;
  maximumPixelRatio: number;
  shadowMapSize: 0 | 1024 | 1536 | 2048;
  ambientOcclusion: boolean;
  depthOfField: 'off' | 'menus' | 'cinematic';
  particleBudget: number;
}

export const qualityProfiles = {
  compatibility: {
    renderScaleMin: 0.55,
    renderScaleMax: 0.72,
    maximumPixelRatio: 1,
    shadowMapSize: 0,
    ambientOcclusion: false,
    depthOfField: 'off',
    particleBudget: 220,
  },
  mobile: {
    renderScaleMin: 0.65,
    renderScaleMax: 0.88,
    maximumPixelRatio: 1.35,
    shadowMapSize: 1024,
    ambientOcclusion: false,
    depthOfField: 'menus',
    particleBudget: 650,
  },
  desktop: {
    renderScaleMin: 0.82,
    renderScaleMax: 1,
    maximumPixelRatio: 1.75,
    shadowMapSize: 1536,
    ambientOcclusion: true,
    depthOfField: 'menus',
    particleBudget: 1600,
  },
  cinematic: {
    renderScaleMin: 0.9,
    renderScaleMax: 1,
    maximumPixelRatio: 2,
    shadowMapSize: 2048,
    ambientOcclusion: true,
    depthOfField: 'cinematic',
    particleBudget: 3200,
  },
} as const satisfies Record<string, QualityProfile>;
