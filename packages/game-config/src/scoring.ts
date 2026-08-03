export interface ScoringConfig {
  distancePointsPerMetre: number;
  fragmentPoints: number;
  nearMissPoints: number;
  targetSkipPoints: number;
  releaseGrades: Readonly<{
    safe: number;
    good: number;
    perfect: number;
    overdrive: number;
  }>;
  comboStep: number;
  maximumCombo: number;
  comboDecayTicks: number;
}

export const scoringConfig: Readonly<ScoringConfig> = Object.freeze({
  distancePointsPerMetre: 10,
  fragmentPoints: 125,
  nearMissPoints: 180,
  targetSkipPoints: 260,
  releaseGrades: Object.freeze({
    safe: 80,
    good: 180,
    perfect: 420,
    overdrive: 760,
  }),
  comboStep: 0.25,
  maximumCombo: 8,
  comboDecayTicks: 210,
});
