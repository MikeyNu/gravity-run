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
  combo: number;
  fragments: number;
  distance: number;
  failureReason: SimulationSnapshot['failureReason'];
  countdownTicks: number;
  lastReleaseGrade: SimulationSnapshot['lastReleaseGrade'];
  updateFromSnapshot: (snapshot: SimulationSnapshot) => void;
  setQuality: (quality: QualityTier) => void;
}

export const useHudStore = create<HudState>((set) => ({
  tick: 0,
  speed: 0,
  phase: 'countdown',
  targetLocked: false,
  quality: 'desktop',
  score: 0,
  combo: 1,
  fragments: 0,
  distance: 0,
  failureReason: null,
  countdownTicks: 120,
  lastReleaseGrade: null,
  updateFromSnapshot(snapshot) {
    set({
      tick: snapshot.tick,
      speed: snapshot.playerSpeed,
      phase: snapshot.phase,
      targetLocked: snapshot.targetLocked,
      score: snapshot.score,
      combo: snapshot.combo,
      fragments: snapshot.fragments,
      distance: snapshot.distance,
      failureReason: snapshot.failureReason,
      countdownTicks: snapshot.countdownTicks,
      lastReleaseGrade: snapshot.lastReleaseGrade,
    });
  },
  setQuality(quality) {
    set({ quality });
  },
}));
