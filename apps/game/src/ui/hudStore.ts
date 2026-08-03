import type { SimulationSnapshot } from '../game/simulation/types';
import type { QualityTier } from '../render/quality/detectQualityTier';
import { create } from 'zustand';

interface HudState {
  tick: number;
  speed: number;
  phase: SimulationSnapshot['phase'];
  targetLocked: boolean;
  quality: QualityTier;
  updateFromSnapshot: (snapshot: SimulationSnapshot) => void;
  setQuality: (quality: QualityTier) => void;
}

export const useHudStore = create<HudState>((set) => ({
  tick: 0,
  speed: 0,
  phase: 'free-flight',
  targetLocked: false,
  quality: 'desktop',
  updateFromSnapshot(snapshot) {
    set({
      tick: snapshot.tick,
      speed: snapshot.playerSpeed,
      phase: snapshot.phase,
      targetLocked: snapshot.targetLocked,
    });
  },
  setQuality(quality) {
    set({ quality });
  },
}));
