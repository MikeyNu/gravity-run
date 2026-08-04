import * as THREE from 'three';
import type { GravityWellClass } from '@gravity-run/game-config';
import type { SimulationSnapshot } from '@gravity-run/simulation';
import { GameplayAssetLibrary } from '../assets/GameplayAssetLibrary';
import { WellAssetLibrary } from '../assets/WellAssetLibrary';
import type { QualityTier } from '../quality/detectQualityTier';

export class CourseSceneController {
  readonly #group: THREE.Group;
  readonly #wellAssets: WellAssetLibrary;
  readonly #gameplayAssets: GameplayAssetLibrary;
  #signature = '';

  constructor(group: THREE.Group, quality: QualityTier, renderer: THREE.WebGLRenderer) {
    this.#group = group;
    this.#wellAssets = new WellAssetLibrary(quality, renderer);
    this.#gameplayAssets = new GameplayAssetLibrary(quality, renderer);
  }

  async preload(): Promise<void> {
    await Promise.all([this.#wellAssets.preload(), this.#gameplayAssets.preload()]);
    this.#signature = '';
  }

  sync(snapshot: SimulationSnapshot): void {
    const signature = `${snapshot.modules.map((module) => module.id).join(':')}|${snapshot.collectedFragmentIds.join(':')}`;
    if (signature === this.#signature) return;
    this.#signature = signature;
    this.#disposeChildren();
    const collected = new Set(snapshot.collectedFragmentIds);

    for (const well of snapshot.wells) {
      const object = this.#wellAssets.create(well.class) ?? this.#wellFallback(well.class);
      object.position.set(well.position.x, well.position.y, well.position.z);
      object.scale.setScalar(
        well.physicalRadius / (this.#wellAssets.has(well.class) ? 1.68 : 1.35),
      );
      object.userData.gravityWell = true;
      object.userData.phaseOffset = hashPhase(well.id);
      object.userData.wellClass = well.class;
      object.userData.previousPulse = 1;
      this.#group.add(object);
    }

    for (const hazard of snapshot.hazards) {
      const object = this.#gameplayAssets.create(hazard.kind) ?? hazardFallback(hazard.kind);
      const reference = this.#gameplayAssets.referenceHalfExtents(hazard.kind);
      object.position.set(hazard.position.x, hazard.position.y, hazard.position.z);
      object.scale.set(
        hazard.halfExtents.x / reference.x,
        hazard.halfExtents.y / reference.y,
        hazard.halfExtents.z / reference.z,
      );
      object.userData.gameplayHazard = true;
      object.userData.hazardKind = hazard.kind;
      object.userData.phaseOffset = hashPhase(hazard.id);
      object.userData.baseX = hazard.position.x;
      object.userData.baseY = hazard.position.y;
      object.userData.baseZ = hazard.position.z;
      object.userData.hazardMotion = hazard.motion;
      this.#group.add(object);
    }

    for (const pickup of snapshot.pickups) {
      if (collected.has(pickup.id)) continue;
      const object = this.#gameplayAssets.create('fragment') ?? fragmentFallback();
      const reference = this.#gameplayAssets.referenceHalfExtents('fragment');
      object.position.set(pickup.position.x, pickup.position.y, pickup.position.z);
      object.scale.setScalar(pickup.radius / reference.x);
      object.userData.gameplayPickup = true;
      object.userData.phaseOffset = hashPhase(pickup.id);
      object.userData.baseY = pickup.position.y;
      this.#group.add(object);
    }
  }

  animate(frameDelta: number, elapsedSeconds: number, reducedMotion: boolean): void {
    for (const child of this.#group.children) {
      const phase = Number(child.userData.phaseOffset ?? 0);
      if (child.userData.gravityWell) {
        const classMultiplier =
          child.userData.wellClass === 'accelerator'
            ? 1.55
            : child.userData.wellClass === 'precision'
              ? 0.78
              : 1;
        child.rotation.z += frameDelta * (reducedMotion ? 0.08 : 0.34) * classMultiplier;
        child.rotation.x = reducedMotion
          ? 0
          : Math.sin(elapsedSeconds * 0.72 + phase) * 0.025;
        const pulse = reducedMotion
          ? 1
          : 1 + Math.sin(elapsedSeconds * 2.1 + phase) * 0.018;
        const previousPulse = Number(child.userData.previousPulse ?? 1);
        child.scale.multiplyScalar(pulse / previousPulse);
        child.userData.previousPulse = pulse;
        continue;
      }

      if (child.userData.gameplayPickup) {
        child.rotation.y += frameDelta * (reducedMotion ? 0.2 : 1.15);
        child.rotation.z = Math.sin(elapsedSeconds * 0.9 + phase) * 0.22;
        child.position.y =
          Number(child.userData.baseY ?? child.position.y) +
          (reducedMotion ? 0 : Math.sin(elapsedSeconds * 2.2 + phase) * 0.18);
        continue;
      }

      if (!child.userData.gameplayHazard) continue;
      const kind: string = child.userData.hazardKind;
      if (kind === 'blade') {
        child.rotation.x += frameDelta * (reducedMotion ? 0.15 : 0.65);
      } else if (kind === 'debris') {
        child.rotation.y += frameDelta * (reducedMotion ? 0.025 : 0.12);
        child.rotation.z += frameDelta * (reducedMotion ? 0.018 : 0.07);
      } else if (kind === 'saw') {
        child.rotation.x += frameDelta * (reducedMotion ? 0.5 : 2.4);
      }

      const motion = child.userData.hazardMotion as { kind: string; axis?: string; amplitude?: number; period?: number; phase?: number; rpm?: number } | undefined;
      if (!motion || motion.kind === 'static') continue;
      const TAU = Math.PI * 2;
      if ((motion.kind === 'oscillate' || motion.kind === 'pendulum') && motion.amplitude !== undefined && motion.period !== undefined && motion.phase !== undefined) {
        const offset = reducedMotion
          ? 0
          : motion.amplitude * Math.sin(TAU * elapsedSeconds / motion.period + motion.phase);
        child.position.x = Number(child.userData.baseX) + (motion.axis === 'x' ? offset : 0);
        child.position.y = Number(child.userData.baseY) + (motion.axis === 'y' ? offset : 0);
        child.position.z = Number(child.userData.baseZ) + (motion.axis === 'z' ? offset : 0);
      }
    }
  }

  dispose(): void {
    this.#disposeChildren();
    this.#wellAssets.dispose();
    this.#gameplayAssets.dispose();
  }

  #disposeChildren(): void {
    for (const child of [...this.#group.children]) {
      this.#group.remove(child);
      child.traverse((object) => {
        if (
          !(object instanceof THREE.Mesh) ||
          object.userData.managedByWellLibrary ||
          object.userData.managedByGameplayAssetLibrary
        ) return;
        object.geometry.dispose();
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          material.dispose();
        }
      });
    }
  }

  #wellFallback(kind: GravityWellClass): THREE.Group {
    const palette = {
      standard: [0x1f2b3a, 0x8fe8ff],
      accelerator: [0x392715, 0xffc247],
      precision: [0x241a3a, 0xd7a8ff],
      recovery: [0x17352e, 0x79ffd2],
    }[kind];
    const group = new THREE.Group();
    group.add(
      new THREE.Mesh(
        new THREE.TorusGeometry(1.15, 0.16, 12, 48),
        new THREE.MeshStandardMaterial({
          color: palette[0],
          roughness: 0.26,
          metalness: 0.82,
          emissive: palette[0],
          emissiveIntensity: 1.2,
        }),
      ),
      new THREE.Mesh(
        new THREE.TorusGeometry(0.72, 0.07, 8, 36),
        new THREE.MeshBasicMaterial({ color: palette[1] }),
      ),
      new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 20, 14),
        new THREE.MeshBasicMaterial({ color: palette[1] }),
      ),
    );
    return group;
  }
}

function hazardFallback(kind: string): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: kind === 'collapse-gate' ? 0x3c434c : 0x171c24,
    roughness: 0.66,
    metalness: 0.48,
  });
  const warning = new THREE.MeshBasicMaterial({ color: 0xff5b2d, toneMapped: false });
  if (kind === 'spire') {
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.9, 8.2, 18), material);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 8, 28), warning);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.8;
    group.add(body, ring);
  } else if (kind === 'blade') {
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 24), material);
    hub.rotation.z = Math.PI / 2;
    group.add(hub);
    for (let index = 0; index < 4; index += 1) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.45, 0.26), warning);
      blade.position.y = 0.88;
      blade.rotation.x = index * Math.PI * 0.5;
      group.add(blade);
    }
  } else if (kind === 'debris') {
    group.add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.92, 0), material));
  } else if (kind === 'saw') {
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.35, 12), material);
    hub.rotation.z = Math.PI / 2;
    group.add(hub);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.12, 32), warning);
    disc.rotation.z = Math.PI / 2;
    group.add(disc);
  } else if (kind === 'piston') {
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.7), material);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.28, 1.1), warning);
    cap.position.y = 0.84;
    group.add(shaft, cap);
  } else if (kind === 'swinging-arm') {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 6.5), material);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), warning);
    head.position.z = 3.5;
    group.add(arm, head);
  } else {
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1.8, 6.8, 5.8), material));
  }
  return group;
}

function fragmentFallback(): THREE.Group {
  const group = new THREE.Group();
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.48, 1),
    new THREE.MeshPhysicalMaterial({
      color: 0xf5b61b,
      emissive: 0xf5a30a,
      emissiveIntensity: 3.4,
      roughness: 0.16,
      metalness: 0.18,
      clearcoat: 1,
    }),
  );
  const cage = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.025, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0x69d8ff, toneMapped: false }),
  );
  cage.rotation.x = Math.PI / 2;
  group.add(crystal, cage);
  return group;
}

function hashPhase(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 0xffffffff) * Math.PI * 2;
}
