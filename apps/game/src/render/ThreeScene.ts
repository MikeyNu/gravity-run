import * as THREE from 'three';
import type { PresentationPort } from '../game/core/GameRuntime';
import type { SimulationSnapshot } from '../game/simulation/types';
import type { QualityTier } from './quality/detectQualityTier';

export class ThreeScene implements PresentationPort {
  readonly #host: HTMLElement;
  readonly #renderer: THREE.WebGLRenderer;
  readonly #scene = new THREE.Scene();
  readonly #camera = new THREE.PerspectiveCamera(54, 1, 0.1, 250);
  readonly #player = new THREE.Group();
  readonly #well = new THREE.Group();
  readonly #tether: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  readonly #clock = new THREE.Clock();

  constructor(host: HTMLElement, quality: QualityTier) {
    this.#host = host;
    this.#renderer = new THREE.WebGLRenderer({
      antialias: quality !== 'compatibility',
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.#renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.#renderer.toneMapping = THREE.AgXToneMapping;
    this.#renderer.toneMappingExposure = 1.05;
    this.#renderer.setPixelRatio(this.#pixelRatioForTier(quality));
    this.#renderer.shadowMap.enabled = quality !== 'compatibility';
    this.#renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.#host.appendChild(this.#renderer.domElement);

    this.#scene.background = new THREE.Color(0x050608);
    this.#scene.fog = new THREE.FogExp2(0x07090e, 0.016);

    this.#camera.position.set(-2.6, 4.2, 14);
    this.#camera.lookAt(0, 0, 0);

    this.#createLighting();
    this.#createPlayer();
    this.#createWell();
    this.#createEnvironment();

    const tetherGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    const tetherMaterial = new THREE.LineBasicMaterial({
      color: 0x69d8ff,
      transparent: true,
      opacity: 0,
    });
    this.#tether = new THREE.Line(tetherGeometry, tetherMaterial);
    this.#tether.frustumCulled = false;
    this.#scene.add(this.#tether);
  }

  render(
    previous: SimulationSnapshot,
    current: SimulationSnapshot,
    alpha: number,
    frameDeltaSeconds: number,
  ): void {
    const px = THREE.MathUtils.lerp(previous.playerPosition.x, current.playerPosition.x, alpha);
    const py = THREE.MathUtils.lerp(previous.playerPosition.y, current.playerPosition.y, alpha);
    const pz = THREE.MathUtils.lerp(previous.playerPosition.z, current.playerPosition.z, alpha);
    this.#player.position.set(px, py, pz);

    const velocity = new THREE.Vector3(
      current.playerVelocity.x,
      current.playerVelocity.y,
      current.playerVelocity.z,
    );
    if (velocity.lengthSq() > 1e-4) {
      const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(1, 0, 0),
        velocity.normalize(),
      );
      this.#player.quaternion.slerp(targetQuaternion, 1 - Math.exp(-12 * frameDeltaSeconds));
    }

    const focus = new THREE.Vector3(px, py, pz);
    const cameraTarget = focus.clone().add(new THREE.Vector3(-6, 4.4, 14));
    const cameraDamping = 1 - Math.exp(-4.5 * frameDeltaSeconds);
    this.#camera.position.lerp(cameraTarget, cameraDamping);
    this.#camera.lookAt(focus.clone().lerp(new THREE.Vector3(0, 0, 0), current.targetLocked ? 0.28 : 0));
    this.#camera.fov = THREE.MathUtils.lerp(
      this.#camera.fov,
      52 + Math.min(current.playerSpeed * 0.75, 11),
      cameraDamping,
    );
    this.#camera.updateProjectionMatrix();

    const tetherPositions = this.#tether.geometry.attributes.position;
    if (tetherPositions instanceof THREE.BufferAttribute) {
      tetherPositions.setXYZ(0, px, py, pz);
      tetherPositions.setXYZ(1, current.wellPosition.x, current.wellPosition.y, current.wellPosition.z);
      tetherPositions.needsUpdate = true;
    }
    this.#tether.material.opacity = current.targetLocked ? 0.92 : 0;

    const elapsed = this.#clock.getElapsedTime();
    this.#well.rotation.z = elapsed * 0.45;
    this.#well.rotation.y = elapsed * 0.18;

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
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.dispose();
      }
    });
    this.#tether.geometry.dispose();
    this.#tether.material.dispose();
    this.#renderer.dispose();
    this.#renderer.domElement.remove();
  }

  #createLighting(): void {
    const hemisphere = new THREE.HemisphereLight(0x9dbdff, 0x171008, 1.5);
    this.#scene.add(hemisphere);

    const key = new THREE.DirectionalLight(0xffd69a, 4.2);
    key.position.set(-8, 12, 9);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 45;
    key.shadow.camera.left = -14;
    key.shadow.camera.right = 14;
    key.shadow.camera.top = 14;
    key.shadow.camera.bottom = -14;
    this.#scene.add(key);

    const rim = new THREE.PointLight(0x4fc8ff, 45, 18, 2);
    rim.position.set(0, 2, -5);
    this.#scene.add(rim);
  }

  #createPlayer(): void {
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.34, 1.15, 5, 10),
      new THREE.MeshStandardMaterial({
        color: 0x161b25,
        roughness: 0.47,
        metalness: 0.18,
      }),
    );
    body.rotation.z = Math.PI / 2;
    body.castShadow = true;

    const visor = new THREE.Mesh(
      new THREE.SphereGeometry(0.31, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
      new THREE.MeshPhysicalMaterial({
        color: 0x93dfff,
        emissive: 0x153a5c,
        emissiveIntensity: 2.4,
        roughness: 0.18,
        metalness: 0.35,
        clearcoat: 1,
      }),
    );
    visor.position.x = 0.7;
    visor.rotation.z = -Math.PI / 2;

    const core = new THREE.Mesh(
      new THREE.CircleGeometry(0.16, 24),
      new THREE.MeshBasicMaterial({ color: 0x5edcff }),
    );
    core.position.set(0.05, 0, 0.35);
    core.rotation.y = Math.PI;

    this.#player.add(body, visor, core);
    this.#player.position.set(-7.5, 0.4, 0);
    this.#scene.add(this.#player);
  }

  #createWell(): void {
    const outer = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.16, 12, 48),
      new THREE.MeshStandardMaterial({
        color: 0x1e2633,
        roughness: 0.26,
        metalness: 0.82,
        emissive: 0x102948,
        emissiveIntensity: 1.4,
      }),
    );
    outer.castShadow = true;

    const inner = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.07, 8, 36),
      new THREE.MeshBasicMaterial({ color: 0x66dcff }),
    );
    inner.rotation.x = Math.PI / 2;

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 24, 18),
      new THREE.MeshBasicMaterial({ color: 0xe8fbff }),
    );

    this.#well.add(outer, inner, core);
    this.#scene.add(this.#well);
  }

  #createEnvironment(): void {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: 0x090b10, roughness: 0.94, metalness: 0.05 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3.2;
    floor.receiveShadow = true;
    this.#scene.add(floor);

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0x11151d,
      roughness: 0.82,
      metalness: 0.22,
    });
    const towers = new THREE.InstancedMesh(geometry, material, 52);
    const matrix = new THREE.Matrix4();

    for (let index = 0; index < 52; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const x = (index - 26) * 2.1;
      const y = -1.5 + ((index * 17) % 7) * 0.18;
      const z = side * (7 + ((index * 11) % 5));
      const height = 2.5 + ((index * 19) % 9) * 0.72;
      matrix.compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ((index * 7) % 9) * 0.04, 0)),
        new THREE.Vector3(1.1 + (index % 3) * 0.4, height, 1.4 + (index % 4) * 0.35),
      );
      towers.setMatrixAt(index, matrix);
    }
    towers.castShadow = true;
    towers.receiveShadow = true;
    this.#scene.add(towers);
  }

  #pixelRatioForTier(quality: QualityTier): number {
    const deviceRatio = window.devicePixelRatio || 1;
    if (quality === 'compatibility') return Math.min(deviceRatio, 1);
    if (quality === 'mobile') return Math.min(deviceRatio, 1.35);
    return Math.min(deviceRatio, 1.75);
  }
}
