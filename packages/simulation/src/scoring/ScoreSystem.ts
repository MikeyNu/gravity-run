import { scoringConfig, type GravityWellDefinition } from '@gravity-run/game-config';

export type ReleaseGrade = 'safe' | 'good' | 'perfect' | 'overdrive';

export interface ScoreSnapshot {
  score: number;
  combo: number;
  maximumCombo: number;
  fragments: number;
  nearMisses: number;
  lastReleaseGrade: ReleaseGrade | null;
}

export class ScoreSystem {
  #score = 0;
  #combo = 1;
  #maximumCombo = 1;
  #fragments = 0;
  #nearMisses = 0;
  #lastDistance = 0;
  #comboDecayRemaining = 0;
  #lastReleaseGrade: ReleaseGrade | null = null;

  reset(): void {
    this.#score = 0;
    this.#combo = 1;
    this.#maximumCombo = 1;
    this.#fragments = 0;
    this.#nearMisses = 0;
    this.#lastDistance = 0;
    this.#comboDecayRemaining = 0;
    this.#lastReleaseGrade = null;
  }

  step(distanceMetres: number): void {
    const delta = Math.max(distanceMetres - this.#lastDistance, 0);
    this.#score += delta * scoringConfig.distancePointsPerMetre * this.#combo;
    this.#lastDistance = Math.max(this.#lastDistance, distanceMetres);
    if (this.#comboDecayRemaining > 0) {
      this.#comboDecayRemaining -= 1;
      if (this.#comboDecayRemaining === 0) this.#combo = Math.max(1, this.#combo - scoringConfig.comboStep);
    }
  }

  recordRelease(alignment: number, missDistance: number, speed: number, well: GravityWellDefinition): ReleaseGrade {
    let grade: ReleaseGrade = 'safe';
    if (alignment >= 0.985 && missDistance <= 2.2 && speed >= 25) grade = 'overdrive';
    else if (alignment >= 0.97 && missDistance <= 3.3) grade = 'perfect';
    else if (alignment >= 0.9 && missDistance <= 5.5) grade = 'good';

    this.#lastReleaseGrade = grade;
    this.#score += scoringConfig.releaseGrades[grade] * this.#combo * (1 + well.risk * 0.25);
    if (grade !== 'safe') {
      this.#combo = Math.min(this.#combo + scoringConfig.comboStep, scoringConfig.maximumCombo);
      this.#maximumCombo = Math.max(this.#maximumCombo, this.#combo);
      this.#comboDecayRemaining = scoringConfig.comboDecayTicks;
    } else {
      this.breakCombo();
    }
    return grade;
  }

  collectFragment(value: number): void {
    this.#fragments += value;
    this.#score += scoringConfig.fragmentPoints * value * this.#combo;
    this.#comboDecayRemaining = scoringConfig.comboDecayTicks;
  }

  recordNearMiss(): void {
    this.#nearMisses += 1;
    this.#score += scoringConfig.nearMissPoints * this.#combo;
    this.#combo = Math.min(this.#combo + scoringConfig.comboStep, scoringConfig.maximumCombo);
    this.#maximumCombo = Math.max(this.#maximumCombo, this.#combo);
    this.#comboDecayRemaining = scoringConfig.comboDecayTicks;
  }

  breakCombo(): void {
    this.#combo = 1;
    this.#comboDecayRemaining = 0;
  }

  snapshot(): ScoreSnapshot {
    return {
      score: Math.floor(this.#score),
      combo: this.#combo,
      maximumCombo: this.#maximumCombo,
      fragments: this.#fragments,
      nearMisses: this.#nearMisses,
      lastReleaseGrade: this.#lastReleaseGrade,
    };
  }
}
