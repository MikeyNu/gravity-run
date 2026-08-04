import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GravityWellClass } from '@gravity-run/game-config';
import type { QualityTier } from '../quality/detectQualityTier';

const MODEL_URL = '/assets/models/gravity-well-family.glb';

export class WellAssetLibrary {
  readonly #loader = new GLTFLoader();
  readonly #quality: QualityTier;
  readonly #prototypes = new Map<GravityWellClass, THREE.Group>();
  #readyPromise: Promise<void> | null = null;

  constructor(quality: QualityTier) {
    this.#quality = quality;
  }

  preload(): Promise<void> {
    if (this.#readyPromise) return this.#readyPromise;
    this.#readyPromise = this.#loader.loadAsync(MODEL_URL).then((gltf) => {
      const lod = this.#lodForQuality();
      for (const kind of ['standard', 'accelerator', 'precision', 'recovery'] as const) {
        const prefix = `well_${kind}_lod${lod}_`;
        const group = new THREE.Group();
        group.name = `well_${kind}_lod${lod}`;
        gltf.scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          if (!object.name.startsWith(prefix)) return;
          if (object.name.endsWith('_COLLISION') || object.name.endsWith('_OCCLUSION')) return;
          const clone = object.clone();
          clone.geometry = object.geometry;
          clone.material = Array.isArray(object.material)
            ? object.material.map((material) => this.#prepareMaterial(material))
            : this.#prepareMaterial(object.material);
          clone.castShadow = this.#quality !== 'compatibility';
          clone.receiveShadow = this.#quality !== 'compatibility';
          group.add(clone);
        });
        if (group.children.length > 0) this.#prototypes.set(kind, group);
      }
    }).catch((error: unknown) => {
      console.warn('[Gravity Run] Gravity-well GLB unavailable; using procedural fallback.', error);
    });
    return this.#readyPromise;
  }

  has(kind: GravityWellClass): boolean {
    return this.#prototypes.has(kind);
  }

  create(kind: GravityWellClass): THREE.Group | null {
    const prototype = this.#prototypes.get(kind);
    if (!prototype) return null;
    const clone = prototype.clone(true);
    clone.traverse((object) => {
      object.userData.managedByWellLibrary = true;
    });
    clone.userData.gravityWell = true;
    clone.userData.wellClass = kind;
    return clone;
  }

  dispose(): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    for (const prototype of this.#prototypes.values()) {
      prototype.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
        }
      });
    }
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    this.#prototypes.clear();
  }

  #prepareMaterial(material: THREE.Material): THREE.Material {
    const clone = material.clone();
    if (clone instanceof THREE.MeshStandardMaterial) {
      clone.envMapIntensity = 1.15;
      if (clone.emissive.getHex() !== 0) clone.emissiveIntensity = 2.6;
      clone.needsUpdate = true;
    }
    return clone;
  }

  #lodForQuality(): 0 | 1 | 2 {
    if (this.#quality === 'compatibility') return 2;
    if (this.#quality === 'mobile') return 1;
    return 0;
  }
}
