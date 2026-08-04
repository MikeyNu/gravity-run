import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { QualityTier } from '../quality/detectQualityTier';

const HDRI_URL = '/assets/env/night_city_probe.hdr';
const FALLBACK_COLORS: [number, number, number] = [0x0a1628, 0x040810, 0x06121e];

export class EnvironmentProbes {
  readonly #scene: THREE.Scene;
  readonly #renderer: THREE.WebGLRenderer;
  readonly #quality: QualityTier;
  #pmrem: THREE.PMREMGenerator | null = null;
  #envMap: THREE.Texture | null = null;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer, quality: QualityTier) {
    this.#scene = scene;
    this.#renderer = renderer;
    this.#quality = quality;
  }

  async init(): Promise<void> {
    this.#pmrem = new THREE.PMREMGenerator(this.#renderer);
    this.#pmrem.compileEquirectangularShader();

    try {
      await this.#loadHdri();
    } catch {
      this.#useProcedural();
    }
  }

  dispose(): void {
    this.#envMap?.dispose();
    this.#pmrem?.dispose();
    this.#pmrem = null;
    this.#envMap = null;
  }

  // ── private ──────────────────────────────────────────────────────────────

  async #loadHdri(): Promise<void> {
    const loader = new HDRLoader();
    const equirec = await loader.loadAsync(HDRI_URL);
    equirec.mapping = THREE.EquirectangularReflectionMapping;

    const envMap = this.#pmrem!.fromEquirectangular(equirec).texture;
    equirec.dispose();

    this.#envMap = envMap;
    this.#scene.environment = envMap;
    // Don't use HDRI as background — we have a custom skybox/fog
    this.#applyToMaterials();
  }

  #useProcedural(): void {
    if (!this.#pmrem) return;

    // Synthesise a minimal night-sky environment from three directional sources
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(FALLBACK_COLORS[0], 2.4));
    const key = new THREE.DirectionalLight(0x8dc8ff, 3.2);
    key.position.set(-1, 3, 2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffd69a, 0.8);
    fill.position.set(2, 1, -3);
    scene.add(fill);

    const room = new RoomEnvironment();
    const envMap = this.#pmrem.fromScene(room).texture;
    this.#envMap = envMap;
    this.#scene.environment = envMap;
    this.#applyToMaterials();
  }

  #applyToMaterials(): void {
    if (!this.#envMap) return;
    const intensityByQuality: Record<QualityTier, number> = {
      compatibility: 0.4,
      mobile: 0.7,
      desktop: 1.0,
      cinematic: 1.3,
    };
    const intensity = intensityByQuality[this.#quality];
    this.#scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material instanceof THREE.MeshStandardMaterial ||
            material instanceof THREE.MeshPhysicalMaterial) {
          material.envMap = this.#envMap;
          material.envMapIntensity = intensity;
          material.needsUpdate = true;
        }
      }
    });
  }
}
