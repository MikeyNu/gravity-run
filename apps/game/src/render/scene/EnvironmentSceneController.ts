import * as THREE from 'three';
import type { CourseModuleDefinition } from '@gravity-run/game-config';
import { EnvironmentAssetLibrary } from '../assets/EnvironmentAssetLibrary';
import { buildEnvironmentPlacements } from '../assets/environmentLayout';
import type { QualityTier } from '../quality/detectQualityTier';

export class EnvironmentSceneController {
  readonly #group: THREE.Group;
  readonly #fallback: THREE.Group;
  readonly #assets: EnvironmentAssetLibrary;
  #signature = '';

  constructor(group: THREE.Group, fallback: THREE.Group, quality: QualityTier, renderer: THREE.WebGLRenderer) {
    this.#group = group;
    this.#fallback = fallback;
    this.#assets = new EnvironmentAssetLibrary(quality, renderer);
    this.#group.visible = false;
    this.#fallback.visible = true;
  }

  async preload(): Promise<void> {
    await this.#assets.preload();
    this.#signature = '';
  }

  sync(modules: readonly CourseModuleDefinition[]): void {
    if (!this.#assets.ready) {
      this.#group.visible = false;
      this.#fallback.visible = true;
      return;
    }

    const signature = modules.map((module) => module.id).join(':');
    if (signature === this.#signature) return;
    this.#signature = signature;
    this.#removeInstances();

    let createdCount = 0;
    for (const placement of buildEnvironmentPlacements(modules)) {
      const object = this.#assets.create(placement.kind);
      if (!object) continue;
      object.name = placement.id;
      object.position.set(placement.position.x, placement.position.y, placement.position.z);
      object.rotation.set(placement.rotation.x, placement.rotation.y, placement.rotation.z);
      object.scale.set(placement.scale.x, placement.scale.y, placement.scale.z);
      object.userData.environmentAnimation = placement.animation;
      object.userData.environmentBaseY = placement.position.y;
      object.userData.environmentBaseRotation = { ...placement.rotation };
      object.userData.environmentBaseScale = { ...placement.scale };
      object.userData.phaseOffset = hashPhase(placement.id);
      this.#group.add(object);
      createdCount += 1;
    }

    const available = createdCount > 0;
    this.#group.visible = available;
    this.#fallback.visible = !available;
    if (!available) this.#signature = '';
  }

  animate(elapsedSeconds: number, reducedMotion: boolean): void {
    for (const child of this.#group.children) {
      const animation = child.userData.environmentAnimation as
        | 'static'
        | 'drift'
        | 'signal'
        | undefined;
      if (!animation || animation === 'static') continue;
      const phase = Number(child.userData.phaseOffset ?? 0);
      const baseRotation = child.userData.environmentBaseRotation as
        | { x: number; y: number; z: number }
        | undefined;

      if (animation === 'drift') {
        child.rotation.x =
          (baseRotation?.x ?? 0) + elapsedSeconds * (reducedMotion ? 0.006 : 0.018);
        child.rotation.y =
          (baseRotation?.y ?? 0) + elapsedSeconds * (reducedMotion ? 0.008 : 0.026);
        child.rotation.z =
          (baseRotation?.z ?? 0) +
          Math.sin(elapsedSeconds * 0.24 + phase) * (reducedMotion ? 0.008 : 0.035);
        child.position.y =
          Number(child.userData.environmentBaseY ?? child.position.y) +
          Math.sin(elapsedSeconds * 0.31 + phase) * (reducedMotion ? 0.03 : 0.16);
        continue;
      }

      const baseScale = child.userData.environmentBaseScale as
        | { x: number; y: number; z: number }
        | undefined;
      const pulse = reducedMotion
        ? 1
        : 1 + Math.sin(elapsedSeconds * 2.1 + phase) * 0.018;
      child.rotation.y =
        (baseRotation?.y ?? 0) +
        Math.sin(elapsedSeconds * 0.42 + phase) * (reducedMotion ? 0.002 : 0.022);
      child.scale.set(
        (baseScale?.x ?? 1) * pulse,
        (baseScale?.y ?? 1) * pulse,
        (baseScale?.z ?? 1) * pulse,
      );
    }
  }

  dispose(): void {
    this.#removeInstances();
    this.#assets.dispose();
  }

  #removeInstances(): void {
    for (const child of [...this.#group.children]) this.#group.remove(child);
  }
}

function hashPhase(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 0xffffffff) * Math.PI * 2;
}
