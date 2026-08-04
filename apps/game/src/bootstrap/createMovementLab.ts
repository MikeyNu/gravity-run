import { movementConfig } from '@gravity-run/game-config';
import { GravityRunSimulation } from '@gravity-run/simulation';
import { GameRuntime } from '../game/core/GameRuntime';
import { InputBuffer } from '../game/input/InputBuffer';
import { TutorialManager } from '../game/tutorial/TutorialManager';
import { ThreeScene } from '../render/ThreeScene';
import { detectQualityTier } from '../render/quality/detectQualityTier';
import { useCharacterStore } from '../ui/characterStore';
import { useHudStore } from '../ui/hudStore';

// Unlock thresholds mirroring CHARACTER_ROSTER unlockCondition strings
const UNLOCK_CHECKS: Array<{ id: string; check: (snap: { distance: number; maximumCombo: number; fragments: number; score: number }) => boolean }> = [
  { id: 'nomad', check: (s) => s.distance >= 1000 },
  { id: 'sentinel', check: (s) => s.maximumCombo >= 5 },
  { id: 'glitch', check: (s) => s.fragments >= 50 },
  { id: 'wisp', check: (s) => s.score >= 25000 },
];

export async function createMovementLab(host: HTMLElement): Promise<GameRuntime> {
  const quality = detectQualityTier();
  const input = new InputBuffer(window);
  const simulation = new GravityRunSimulation('gravity-run-public-alpha');
  const scene = await ThreeScene.create(host, quality);
  const tutorial = new TutorialManager();

  useHudStore.getState().setQuality(quality);

  return new GameRuntime({
    fixedStepSeconds: 1 / movementConfig.simulationHz,
    maxCatchUpSteps: movementConfig.maxCatchUpSteps,
    input,
    simulation,
    presentation: scene,
    onSnapshot(snapshot) {
      useHudStore.getState().updateFromSnapshot(snapshot);
      tutorial.update(snapshot);
      // Check character unlock milestones on every tick
      const charStore = useCharacterStore.getState();
      for (const { id, check } of UNLOCK_CHECKS) {
        if (!charStore.unlockedCharacterIds.has(id as never) && check(snapshot)) {
          charStore.unlockCharacter(id as never);
        }
      }
    },
  });
}
