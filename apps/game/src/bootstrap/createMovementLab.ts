import { movementConfig } from '@gravity-run/game-config';
import { GravityRunSimulation } from '@gravity-run/simulation';
import { GameRuntime } from '../game/core/GameRuntime';
import { InputBuffer } from '../game/input/InputBuffer';
import { ThreeScene } from '../render/ThreeScene';
import { detectQualityTier } from '../render/quality/detectQualityTier';
import { useHudStore } from '../ui/hudStore';

export function createMovementLab(host: HTMLElement): GameRuntime {
  const quality = detectQualityTier();
  const input = new InputBuffer(window);
  const simulation = new GravityRunSimulation('gravity-run-public-alpha');
  const scene = new ThreeScene(host, quality);

  useHudStore.getState().setQuality(quality);

  return new GameRuntime({
    fixedStepSeconds: 1 / movementConfig.simulationHz,
    maxCatchUpSteps: movementConfig.maxCatchUpSteps,
    input,
    simulation,
    presentation: scene,
    onSnapshot(snapshot) {
      useHudStore.getState().updateFromSnapshot(snapshot);
    },
  });
}
