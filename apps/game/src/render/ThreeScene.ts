import * as THREE from 'three';
import { AudioDirector } from '../audio/AudioDirector';
import {
  movementConfig,
  qualityProfiles,
  type GravityWellClass,
} from '@gravity-run/game-config';
import type { PresentationPort } from '../game/core/GameRuntime';
import type { SimulationSnapshot } from '../game/simulation/types';
import { WellAssetLibrary } from './assets/WellAssetLibrary';
import { SpringCameraRig } from './camera/SpringCameraRig';
import { PostProcessingPipeline } from './pipeline/PostProcessingPipeline';
import { AdaptiveResolutionController } from './quality/AdaptiveResolutionController';
import type { QualityTier } from './quality/detectQualityTier';
import { ParticleBurstPool } from './vfx/ParticleBurstPool';
import { PlayerTrail } from './vfx/PlayerTrail';
import { SpeedLineField } from './vfx/SpeedLineField';
import { TetherRibbon } from './vfx/TetherRibbon';

const FORWARD = new THREE.Vector3(1, 0, 0);

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export class ThreeScene implements PresentationPort {
  readonly #host: HTMLElement;
  readonly #quality: QualityTier;
  readonly #renderer: THREE.WebGLRenderer;
  readonly #scene = new THREE.Scene();
  readonly #camera = new THREE.PerspectiveCamera(54, 1, 0.1, 650);
  readonly #cameraRig: SpringCameraRig;
  readonly #pipeline: PostProcessingPipeline;
  readonly #adaptiveResolution: AdaptiveResolutionController;
  readonly #player = new THREE.Group();
  readonly #course = new THREE.Group();
  readonly #tether = new TetherRibbon();
  readonly #trail = new PlayerTrail();
  readonly #speedLines: SpeedLineField;
  readonly #eventParticles: ParticleBurstPool;
  readonly #audio = new AudioDirector();
  readonly #collapse: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  readonly #wellAssets: WellAssetLibrary;
  readonly #targetPosition = new THREE.Vector3();
  readonly #interpolatedPosition = new THREE.Vector3();
  readonly #velocity = new THREE.Vector3();
  #signature = '';
  #width = 1;
  #height = 1;
  #pixelRatio: number;
  #lastPresentationTick = -1;

  constructor(host: HTMLElement, quality: QualityTier) {
    this.#host = host;
    this.#quality = quality;
    this.#pixelRatio = Math.min(
      window.devicePixelRatio || 1,
      qualityProfiles[quality].maximumPixelRatio,
    );
    this.#adaptiveResolution = new AdaptiveResolutionController(quality);
    this.#wellAssets = new WellAssetLibrary(quality);
    void this.#wellAssets.preload().then(() => {
      this.#signature = '';
    });

    this.#renderer = new THREE.WebGLRenderer({
      antialias: quality === 'compatibility',
      powerPreference: 'high-performance',
      stencil: false,
      alpha: false,
    });
    this.#renderer.shadowMap.enabled = quality !== 'compatibility';
    this.#renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.#renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.#renderer.domElement);

    this.#scene.background = new THREE.Color(0x04060a);
    this.#scene.fog = new THREE.FogExp2(
      0x080b12,
      quality === 'compatibility' ? 0.016 : quality === 'mobile' ? 0.013 : 0.0105,
    );
    this.#scene.add(this.#course);
    this.#createLighting();
    this.#createPlayer();
    this.#createWorldDressing();

    this.#scene.add(this.#tether.object, this.#trail.object);
    this.#speedLines = new SpeedLineField(
      quality === 'compatibility' ? 18 : quality === 'mobile' ? 42 : quality === 'desktop' ? 78 : 112,
    );
    this.#scene.add(this.#speedLines.object);
    this.#eventParticles = new ParticleBurstPool(
      quality === 'compatibility' ? 96 : quality === 'mobile' ? 160 : quality === 'desktop' ? 240 : 320,
    );
    this.#scene.add(this.#eventParticles.object);

    this.#collapse = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 90),
      new THREE.MeshBasicMaterial({
        color: 0xff6d39,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.#collapse.rotation.y = Math.PI / 2;
    this.#scene.add(this.#collapse);

    this.#cameraRig = new SpringCameraRig(this.#camera);
    this.#pipeline = new PostProcessingPipeline(
      this.#renderer,
      this.#scene,
      this.#camera,
      quality,
    );
  }

  render(
    previous: SimulationSnapshot,
    current: SimulationSnapshot,
    alpha: number,
    frameDelta: number,
  ): void {
    this.#syncCourse(current);
    this.#interpolatedPosition.set(
      THREE.MathUtils.lerp(previous.playerPosition.x, current.playerPosition.x, alpha),
      THREE.MathUtils.lerp(previous.playerPosition.y, current.playerPosition.y, alpha),
      THREE.MathUtils.lerp(previous.playerPosition.z, current.playerPosition.z, alpha),
    );
    this.#player.position.copy(this.#interpolatedPosition);
    this.#velocity.set(
      current.playerVelocity.x,
      current.playerVelocity.y,
      current.playerVelocity.z,
    );

    if (this.#velocity.lengthSq() > 1e-4) {
      const orientation = new THREE.Quaternion().setFromUnitVectors(
        FORWARD,
        this.#velocity.clone().normalize(),
      );
      this.#player.quaternion.slerp(
        orientation,
        1 - Math.exp(-12 * Math.max(frameDelta, 0)),
      );
    }

    const targetId = current.activeTargetId ?? current.previewTargetId;
    const target = targetId
      ? current.wells.find((well) => well.id === targetId)
      : undefined;
    const targetPosition = target
      ? this.#targetPosition.set(target.position.x, target.position.y, target.position.z)
      : null;
    const reducedMotion = this.#reducedMotion();

    this.#cameraRig.update({
      playerPosition: this.#interpolatedPosition,
      playerVelocity: this.#velocity,
      targetPosition,
      targetLocked: current.targetLocked,
      speed: current.playerSpeed,
      aspect: this.#width / this.#height,
      reducedMotion,
      deltaSeconds: frameDelta,
    });

    this.#tether.update(
      this.#interpolatedPosition,
      targetPosition,
      this.#camera.position,
      current.playerSpeed / movementConfig.maximumSpeed,
      current.targetLocked,
    );
    this.#trail.update(this.#interpolatedPosition, current.playerSpeed, reducedMotion);
    this.#speedLines.update(
      this.#interpolatedPosition,
      this.#velocity,
      current.playerSpeed,
      reducedMotion,
    );
    this.#processPresentationEvents(previous, current);
    this.#eventParticles.update(frameDelta);
    this.#audio.update(previous, current);

    this.#collapse.position.set(current.collapseX, 3, 0);
    this.#collapse.material.opacity = THREE.MathUtils.clamp(
      0.32 - Math.max(this.#interpolatedPosition.x - current.collapseX, 0) * 0.006,
      0.07,
      0.32,
    );
    this.#animateCourse(frameDelta, current.elapsedSeconds, reducedMotion);
    this.#pipeline.render(frameDelta);

    const nextScale = this.#adaptiveResolution.sample(frameDelta * 1000);
    if (nextScale !== null) this.#resizeTargets();
  }

  resize(): void {
    this.#width = Math.max(this.#host.clientWidth, 1);
    this.#height = Math.max(this.#host.clientHeight, 1);
    this.#camera.aspect = this.#width / this.#height;
    this.#camera.updateProjectionMatrix();
    this.#resizeTargets();
  }

  dispose(): void {
    this.#pipeline.dispose();
    this.#tether.dispose();
    this.#trail.dispose();
    this.#speedLines.dispose();
    this.#eventParticles.dispose();
    this.#audio.dispose();
    this.#wellAssets.dispose();
    this.#scene.traverse((object) => {
      if (
        !(object instanceof THREE.Mesh) ||
        object.userData.managedByWellLibrary ||
        object.userData.managedVfx
      ) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        material.dispose();
      }
    });
    this.#renderer.dispose();
    this.#renderer.domElement.remove();
  }

  #processPresentationEvents(previous: SimulationSnapshot, current: SimulationSnapshot): void {
    if (current.tick < this.#lastPresentationTick) {
      this.#lastPresentationTick = current.tick;
      this.#eventParticles.reset();
      return;
    }
    if (current.tick === this.#lastPresentationTick) return;
    this.#lastPresentationTick = current.tick;

    if (previous.phase !== 'released' && current.phase === 'released') {
      this.#eventParticles.emit(
        'release',
        this.#interpolatedPosition,
        this.#velocity,
        current.lastReleaseGrade,
      );
    }
    if (current.fragments > previous.fragments) {
      this.#eventParticles.emit('fragment', this.#interpolatedPosition, this.#velocity);
    }
    if (current.nearMisses > previous.nearMisses) {
      this.#eventParticles.emit('near-miss', this.#interpolatedPosition, this.#velocity);
    }
    if (previous.phase !== 'failed' && current.phase === 'failed') {
      this.#eventParticles.emit('failure', this.#interpolatedPosition, this.#velocity);
    }
  }

  #resizeTargets(): void {
    this.#pipeline.setSize(
      this.#width,
      this.#height,
      this.#pixelRatio,
      this.#adaptiveResolution.scale,
    );
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
      object.scale.setScalar(
        well.physicalRadius / (this.#wellAssets.has(well.class) ? 1.68 : 1.35),
      );
      object.userData.gravityWell = true;
      object.userData.phaseOffset = this.#hashPhase(well.id);
      object.userData.wellClass = well.class;
      object.userData.baseScale = object.scale.x;
      this.#course.add(object);
    }

    for (const hazard of snapshot.hazards) {
      const object = new THREE.Mesh(
        new THREE.BoxGeometry(
          hazard.halfExtents.x * 2,
          hazard.halfExtents.y * 2,
          hazard.halfExtents.z * 2,
        ),
        new THREE.MeshStandardMaterial({
          color: hazard.kind === 'collapse-gate' ? 0x3c434c : 0x171c24,
          roughness: 0.72,
          metalness: 0.28,
        }),
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
        new THREE.MeshPhysicalMaterial({
          color: 0xf5b61b,
          emissive: 0xf5a30a,
          emissiveIntensity: 3.4,
          roughness: 0.2,
          metalness: 0.35,
          clearcoat: 1,
        }),
      );
      object.position.set(pickup.position.x, pickup.position.y, pickup.position.z);
      this.#course.add(object);
    }
  }

  #well(kind: GravityWellClass): THREE.Group {
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

  #createPlayer(): void {
    const suit = new THREE.MeshStandardMaterial({
      color: 0x151b25,
      roughness: 0.48,
      metalness: 0.2,
    });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.15, 5, 10), suit);
    body.rotation.z = Math.PI / 2;
    body.castShadow = true;
    const visor = new THREE.Mesh(
      new THREE.SphereGeometry(0.31, 22, 16),
      new THREE.MeshPhysicalMaterial({
        color: 0x93dfff,
        emissive: 0x2e9ed6,
        emissiveIntensity: 3,
        roughness: 0.16,
        clearcoat: 1,
      }),
    );
    visor.position.x = 0.65;
    const reactor = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.13),
      new THREE.MeshBasicMaterial({ color: 0x69d8ff, toneMapped: false }),
    );
    reactor.position.set(0.05, 0.28, 0);
    this.#player.add(body, visor, reactor);
    this.#scene.add(this.#player);
  }

  #createLighting(): void {
    this.#scene.add(new THREE.HemisphereLight(0xa7c5ff, 0x130d09, 1.35));
    const key = new THREE.DirectionalLight(0xffd69a, 4.6);
    key.position.set(-8, 15, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(
      qualityProfiles[this.#quality].shadowMapSize || 1024,
      qualityProfiles[this.#quality].shadowMapSize || 1024,
    );
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 110;
    this.#scene.add(key);
    const rim = new THREE.DirectionalLight(0x54bcff, 2.2);
    rim.position.set(12, 3, -18);
    this.#scene.add(rim);
  }

  #createWorldDressing(): void {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 220),
      new THREE.MeshStandardMaterial({ color: 0x080a0f, roughness: 0.96 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(500, -9.5, 0);
    floor.receiveShadow = true;
    this.#scene.add(floor);

    const random = seededRandom(0x47525659);
    const towerCount = this.#quality === 'compatibility' ? 54 : this.#quality === 'mobile' ? 92 : 150;
    const towerGeometry = new THREE.BoxGeometry(1, 1, 1);
    const towerMaterial = new THREE.MeshStandardMaterial({
      color: 0x111720,
      roughness: 0.8,
      metalness: 0.28,
    });
    const towers = new THREE.InstancedMesh(towerGeometry, towerMaterial, towerCount);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    for (let index = 0; index < towerCount; index += 1) {
      const side = random() < 0.5 ? -1 : 1;
      position.set(
        random() * 700 - 60,
        random() * 20 - 7,
        side * (22 + random() * 72),
      );
      quaternion.setFromEuler(
        new THREE.Euler(
          (random() - 0.5) * 0.2,
          (random() - 0.5) * 0.35,
          (random() - 0.5) * 0.18,
        ),
      );
      scale.set(4 + random() * 13, 12 + random() * 62, 4 + random() * 16);
      matrix.compose(position, quaternion, scale);
      towers.setMatrixAt(index, matrix);
    }
    towers.instanceMatrix.needsUpdate = true;
    towers.receiveShadow = true;
    this.#scene.add(towers);

    const debrisCount = this.#quality === 'compatibility' ? 36 : this.#quality === 'mobile' ? 76 : 140;
    const debrisGeometry = new THREE.DodecahedronGeometry(1, 0);
    const debrisMaterial = new THREE.MeshStandardMaterial({
      color: 0x1b2029,
      roughness: 0.78,
      metalness: 0.32,
    });
    const debris = new THREE.InstancedMesh(debrisGeometry, debrisMaterial, debrisCount);
    for (let index = 0; index < debrisCount; index += 1) {
      position.set(
        random() * 620 - 40,
        random() * 70 - 20,
        (random() - 0.5) * 120,
      );
      quaternion.setFromEuler(
        new THREE.Euler(random() * Math.PI, random() * Math.PI, random() * Math.PI),
      );
      const size = 0.35 + random() * 2.2;
      scale.setScalar(size);
      matrix.compose(position, quaternion, scale);
      debris.setMatrixAt(index, matrix);
    }
    debris.instanceMatrix.needsUpdate = true;
    this.#scene.add(debris);

    const singularity = new THREE.Group();
    singularity.position.set(135, 38, -62);
    const eventHorizon = new THREE.Mesh(
      new THREE.SphereGeometry(8, 36, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000 }),
    );
    const accretion = new THREE.Mesh(
      new THREE.TorusGeometry(11.5, 1.35, 18, 96),
      new THREE.MeshBasicMaterial({
        color: 0xff8b45,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    accretion.rotation.x = Math.PI * 0.38;
    const halo = new THREE.PointLight(0xff7c43, 180, 130, 2);
    singularity.add(eventHorizon, accretion, halo);
    this.#scene.add(singularity);
  }

  #animateCourse(
    frameDelta: number,
    elapsedSeconds: number,
    reducedMotion: boolean,
  ): void {
    for (const child of this.#course.children) {
      if (!child.userData.gravityWell) continue;
      const phase = Number(child.userData.phaseOffset ?? 0);
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
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          material.dispose();
        }
      });
    }
  }
}
