import * as THREE from 'three';
import type { GravityWellClass } from '@gravity-run/game-config';
import type { PresentationPort } from '../game/core/GameRuntime';
import type { SimulationSnapshot } from '../game/simulation/types';
import type { QualityTier } from './quality/detectQualityTier';
import { WellAssetLibrary } from './assets/WellAssetLibrary';

export class ThreeScene implements PresentationPort {
  readonly #host: HTMLElement;
  readonly #renderer: THREE.WebGLRenderer;
  readonly #scene = new THREE.Scene();
  readonly #camera = new THREE.PerspectiveCamera(54, 1, 0.1, 420);
  readonly #player = new THREE.Group();
  readonly #course = new THREE.Group();
  readonly #tether: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  readonly #collapse: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  readonly #wellAssets: WellAssetLibrary;
  #signature = '';

  constructor(host: HTMLElement, quality: QualityTier) {
    this.#host = host;
    this.#wellAssets = new WellAssetLibrary(quality);
    void this.#wellAssets.preload().then(() => { this.#signature = ''; });
    this.#renderer = new THREE.WebGLRenderer({ antialias: quality !== 'compatibility', powerPreference: 'high-performance' });
    this.#renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.#renderer.toneMapping = THREE.AgXToneMapping;
    this.#renderer.toneMappingExposure = 1.03;
    this.#renderer.setPixelRatio(this.#pixelRatio(quality));
    this.#renderer.shadowMap.enabled = quality !== 'compatibility';
    this.#renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(this.#renderer.domElement);

    this.#scene.background = new THREE.Color(0x050608);
    this.#scene.fog = new THREE.FogExp2(0x07090e, quality === 'mobile' ? 0.013 : 0.0105);
    this.#scene.add(this.#course);
    this.#createLighting();
    this.#createPlayer();
    this.#createSkyline();

    this.#tether = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: 0x69d8ff, transparent: true, opacity: 0 }),
    );
    this.#tether.frustumCulled = false;
    this.#scene.add(this.#tether);

    this.#collapse = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 70),
      new THREE.MeshBasicMaterial({ color: 0xff6d39, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.#collapse.rotation.y = Math.PI / 2;
    this.#scene.add(this.#collapse);
  }

  render(previous: SimulationSnapshot, current: SimulationSnapshot, alpha: number, frameDelta: number): void {
    this.#syncCourse(current);
    const position = new THREE.Vector3(
      THREE.MathUtils.lerp(previous.playerPosition.x, current.playerPosition.x, alpha),
      THREE.MathUtils.lerp(previous.playerPosition.y, current.playerPosition.y, alpha),
      THREE.MathUtils.lerp(previous.playerPosition.z, current.playerPosition.z, alpha),
    );
    this.#player.position.copy(position);

    const velocity = new THREE.Vector3(current.playerVelocity.x, current.playerVelocity.y, current.playerVelocity.z);
    if (velocity.lengthSq() > 1e-4) {
      const orientation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), velocity.clone().normalize());
      this.#player.quaternion.slerp(orientation, 1 - Math.exp(-12 * frameDelta));
    }

    const targetId = current.activeTargetId ?? current.previewTargetId;
    const target = targetId ? current.wells.find((well) => well.id === targetId) : undefined;
    const reducedMotion = this.#reducedMotion();
    const focus = position.clone().add(velocity.multiplyScalar(reducedMotion ? 0.16 : 0.28));
    if (target) focus.lerp(new THREE.Vector3(target.position.x, target.position.y, target.position.z), current.targetLocked ? 0.22 : 0.1);
    const desiredCamera = position.clone().add(
      reducedMotion
        ? new THREE.Vector3(-8.6, 6.2, 16.2)
        : current.targetLocked
          ? new THREE.Vector3(-9.5, 7.3, 17.5)
          : new THREE.Vector3(-8.2, 5.8, 15.5),
    );
    const damping = 1 - Math.exp(-(reducedMotion ? 7.5 : 4.8) * frameDelta);
    this.#camera.position.lerp(desiredCamera, damping);
    this.#camera.lookAt(focus);
    const targetFov = reducedMotion ? 54 : 50 + Math.min(current.playerSpeed * 0.7, 14);
    this.#camera.fov = THREE.MathUtils.lerp(this.#camera.fov, targetFov, damping);
    this.#camera.updateProjectionMatrix();

    const positions = this.#tether.geometry.attributes.position;
    if (positions instanceof THREE.BufferAttribute) {
      positions.setXYZ(0, position.x, position.y, position.z);
      if (target) positions.setXYZ(1, target.position.x, target.position.y, target.position.z);
      positions.needsUpdate = true;
    }
    this.#tether.material.opacity = current.targetLocked && target ? 0.92 : 0;
    this.#collapse.position.set(current.collapseX, 3, 0);
    this.#collapse.material.opacity = THREE.MathUtils.clamp(0.3 - Math.max(position.x - current.collapseX, 0) * 0.006, 0.08, 0.3);
    this.#animateCourse(frameDelta, current.elapsedSeconds, reducedMotion);
    this.#renderer.render(this.#scene, this.#camera);
  }

  resize(): void {
    const width = Math.max(this.#host.clientWidth, 1);
    const height = Math.max(this.#host.clientHeight, 1);
    this.#renderer.setSize(width, height, false);
    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.#scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || object.userData.managedByWellLibrary) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
    });
    this.#tether.geometry.dispose();
    this.#tether.material.dispose();
    this.#wellAssets.dispose();
    this.#renderer.dispose();
    this.#renderer.domElement.remove();
  }

  #syncCourse(snapshot: SimulationSnapshot): void {
    const signature = `${snapshot.modules.map((module) => module.id).join(':')}|${snapshot.collectedFragmentIds.join(':')}`;
    if (signature === this.#signature) return;
    this.#signature = signature;
    this.#disposeChildren(this.#course);
    const collected = new Set(snapshot.collectedFragmentIds);

    for (const well of snapshot.wells) {
      const object = this.#wellAssets.create(well.class) ?? this.#well(well.class);
      object.position.set(well.position.x, well.position.y, well.position.z);
      object.scale.setScalar(well.physicalRadius / (this.#wellAssets.has(well.class) ? 1.68 : 1.35));
      object.userData.gravityWell = true;
      object.userData.phaseOffset = this.#hashPhase(well.id);
      object.userData.wellClass = well.class;
      this.#course.add(object);
    }
    for (const hazard of snapshot.hazards) {
      const object = new THREE.Mesh(
        new THREE.BoxGeometry(hazard.halfExtents.x * 2, hazard.halfExtents.y * 2, hazard.halfExtents.z * 2),
        new THREE.MeshStandardMaterial({ color: hazard.kind === 'collapse-gate' ? 0x3c434c : 0x171c24, roughness: 0.72, metalness: 0.28 }),
      );
      object.position.set(hazard.position.x, hazard.position.y, hazard.position.z);
      object.castShadow = true;
      object.receiveShadow = true;
      this.#course.add(object);
    }
    for (const pickup of snapshot.pickups) {
      if (collected.has(pickup.id)) continue;
      const object = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.48),
        new THREE.MeshPhysicalMaterial({ color: 0xf5b61b, emissive: 0x9b5a04, emissiveIntensity: 2.8, roughness: 0.2, metalness: 0.35, clearcoat: 1 }),
      );
      object.position.set(pickup.position.x, pickup.position.y, pickup.position.z);
      this.#course.add(object);
    }
  }

  #well(kind: GravityWellClass): THREE.Group {
    const palette = {
      standard: [0x1f2b3a, 0x8fe8ff], accelerator: [0x392715, 0xffc247],
      precision: [0x241a3a, 0xd7a8ff], recovery: [0x17352e, 0x79ffd2],
    }[kind];
    const group = new THREE.Group();
    group.add(
      new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.16, 12, 48), new THREE.MeshStandardMaterial({ color: palette[0], roughness: 0.26, metalness: 0.82, emissive: palette[0], emissiveIntensity: 1.2 })),
      new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.07, 8, 36), new THREE.MeshBasicMaterial({ color: palette[1] })),
      new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 14), new THREE.MeshBasicMaterial({ color: palette[1] })),
    );
    return group;
  }

  #createPlayer(): void {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.15, 5, 10), new THREE.MeshStandardMaterial({ color: 0x161b25, roughness: 0.47, metalness: 0.18 }));
    body.rotation.z = Math.PI / 2;
    body.castShadow = true;
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.31, 18, 12), new THREE.MeshPhysicalMaterial({ color: 0x93dfff, emissive: 0x153a5c, emissiveIntensity: 2.4, roughness: 0.18, clearcoat: 1 }));
    visor.position.x = 0.65;
    this.#player.add(body, visor);
    this.#scene.add(this.#player);
  }

  #createLighting(): void {
    this.#scene.add(new THREE.HemisphereLight(0xa7c5ff, 0x130d09, 1.55));
    const key = new THREE.DirectionalLight(0xffd69a, 4.5);
    key.position.set(-8, 15, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.#scene.add(key);
  }

  #createSkyline(): void {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1200, 180), new THREE.MeshStandardMaterial({ color: 0x080a0f, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(400, -9.5, 0);
    this.#scene.add(floor);
  }

  #animateCourse(frameDelta: number, elapsedSeconds: number, reducedMotion: boolean): void {
    for (const child of this.#course.children) {
      if (!child.userData.gravityWell) continue;
      const phase = Number(child.userData.phaseOffset ?? 0);
      const classMultiplier = child.userData.wellClass === 'accelerator' ? 1.55 : child.userData.wellClass === 'precision' ? 0.78 : 1;
      child.rotation.z += frameDelta * (reducedMotion ? 0.08 : 0.34) * classMultiplier;
      child.rotation.x = reducedMotion ? 0 : Math.sin(elapsedSeconds * 0.72 + phase) * 0.025;
      const pulse = reducedMotion ? 1 : 1 + Math.sin(elapsedSeconds * 2.1 + phase) * 0.018;
      child.scale.multiplyScalar(pulse / Number(child.userData.previousPulse ?? 1));
      child.userData.previousPulse = pulse;
    }
  }

  #reducedMotion(): boolean {
    return (
      document.documentElement.dataset.reducedMotion === 'true' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  #hashPhase(value: string): number {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) / 0xffffffff) * Math.PI * 2;
  }

  #disposeChildren(group: THREE.Group): void {
    for (const child of [...group.children]) {
      group.remove(child);
      child.traverse((object) => {
        if (!(object instanceof THREE.Mesh) || object.userData.managedByWellLibrary) return;
        object.geometry.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
      });
    }
  }

  #pixelRatio(quality: QualityTier): number {
    const ratio = window.devicePixelRatio || 1;
    if (quality === 'compatibility') return Math.min(ratio, 1);
    if (quality === 'mobile') return Math.min(ratio, 1.3);
    return Math.min(ratio, 1.7);
  }
}
