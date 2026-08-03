import type { SimulationSnapshot } from '../game/simulation/types';
import type { QualityTier } from '../render/quality/detectQualityTier';
import { create } from 'zustand';

interface HudState {
  tick: number;
  speed: number;
  phase: SimulationSnapshot['phase'];
  targetLocked: boolean;
  quality: QualityTier;
  score: number;
  bestScore: number;
  combo: number;
  maxCombo: number;
  fragments: number;
  distance: number;
  bestDistance: number;
  failureReason: SimulationSnapshot['failureReason'];
  countdownTicks: number;
  lastReleaseGrade: SimulationSnapshot['lastReleaseGrade'];
  updateFromSnapshot: (snapshot: SimulationSnapshot) => void;
  setQuality: (quality: QualityTier) => void;
}

export const useHudStore = create<HudState>((set, get) => ({
  tick: 0,
  speed: 0,
  phase: 'countdown',
  targetLocked: false,
  quality: 'desktop',
  score: 0,
  bestScore: 0,
  combo: 1,
  maxCombo: 1,
  fragments: 0,
  distance: 0,
  bestDistance: 0,
  failureReason: null,
  countdownTicks: 120,
  lastReleaseGrade: null,
  updateFromSnapshot(snapshot) {
    const previous = get();
    set({
      tick: snapshot.tick,
      speed: snapshot.playerSpeed,
      phase: snapshot.phase,
      targetLocked: snapshot.targetLocked,
      score: snapshot.score,
      bestScore: Math.max(previous.bestScore, snapshot.score),
      combo: snapshot.combo,
      maxCombo: Math.max(previous.maxCombo, snapshot.maximumCombo),
      fragments: snapshot.fragments,
      distance: snapshot.distance,
      bestDistance: Math.max(previous.bestDistance, snapshot.distance),
      failureReason: snapshot.failureReason,
      countdownTicks: snapshot.countdownTicks,
      lastReleaseGrade: snapshot.lastReleaseGrade,
    });
  },
  setQuality(quality) {
    set({ quality });
  },
}));
