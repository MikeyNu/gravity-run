import * as THREE from 'three';
import { movementConfig, qualityProfiles } from '@gravity-run/game-config';
import type { SimulationSnapshot } from '@gravity-run/simulation';
import { AudioDirector } from '../audio/AudioDirector';
import type { PresentationPort } from '../game/core/GameRuntime';
import { SpringCameraRig } from './camera/SpringCameraRig';
import { PostProcessingPipeline } from './pipeline/PostProcessingPipeline';
import { AdaptiveResolutionController } from './quality/AdaptiveResolutionController';
import type { QualityTier } from './quality/detectQualityTier';
import { CourseSceneController } from './scene/CourseSceneController';
import { EnvironmentSceneController } from './scene/EnvironmentSceneController';
import { createWorldDressing } from './scene/createWorldDressing';
import { ParticleBurstPool } from './vfx/ParticleBurstPool';
import { PlayerTrail } from './vfx/PlayerTrail';
import { SpeedLineField } from './vfx/SpeedLineField';
import { TetherRibbon } from './vfx/TetherRibbon';

const FORWARD = new THREE.Vector3(1, 0, 0);

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
  readonly #environment = new THREE.Group();
  readonly #environmentFallback = new THREE.Group();
  readonly #courseController: CourseSceneController;
  readonly #environmentController: EnvironmentSceneController;
  readonly #tether = new TetherRibbon();
  readonly #trail = new PlayerTrail();
  readonly #speedLines: SpeedLineField;
  readonly #eventParticles: ParticleBurstPool;
  readonly #audio = new AudioDirector();
  readonly #collapse: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  readonly #targetPosition = new THREE.Vector3();
  readonly #interpolatedPosition = new THREE.Vector3();
  readonly #velocity = new THREE.Vector3();
  readonly #direction = new THREE.Vector3();
  readonly #orientation = new THREE.Quaternion();
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
    this.#scene.add(this.#course, this.#environment, this.#environmentFallback);
    createWorldDressing(this.#scene, this.#environmentFallback, quality);
    this.#createLighting();
    this.#createPlayer();

    this.#courseController = new CourseSceneController(this.#course, quality);
    this.#environmentController = new EnvironmentSceneController(
      this.#environment,
      this.#environmentFallback,
      quality,
    );
    void Promise.all([
      this.#courseController.preload(),
      this.#environmentController.preload(),
    ]);

    this.#scene.add(this.#tether.object, this.#trail.object);
    this.#speedLines = new SpeedLineField(
      quality === 'compatibility'
        ? 18
        : quality === 'mobile'
          ? 42
          : quality === 'desktop'
            ? 78
            : 112,
    );
    this.#scene.add(this.#speedLines.object);
    this.#eventParticles = new ParticleBurstPool(
      quality === 'compatibility'
        ? 96
        : quality === 'mobile'
          ? 160
          : quality === 'desktop'
            ? 240
            : 320,
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
    this.#courseController.sync(current);
    this.#environmentController.sync(current.modules);

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
      this.#direction.copy(this.#velocity).normalize();
      this.#orientation.setFromUnitVectors(FORWARD, this.#direction);
      this.#player.quaternion.slerp(
        this.#orientation,
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
    this.#courseController.animate(frameDelta, current.elapsedSeconds, reducedMotion);
    this.#environmentController.animate(current.elapsedSeconds, reducedMotion);
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
    this.#courseController.dispose();
    this.#environmentController.dispose();
    this.#pipeline.dispose();
    this.#tether.dispose();
    this.#trail.dispose();
    this.#speedLines.dispose();
    this.#eventParticles.dispose();
    this.#audio.dispose();

    this.#scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || object.userData.managedVfx) return;
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

  #processPresentationEvents(
    previous: SimulationSnapshot,
    current: SimulationSnapshot,
  ): void {
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

  #reducedMotion(): boolean {
    return (
      document.documentElement.dataset.reducedMotion === 'true' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}
