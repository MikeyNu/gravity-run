import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { HazardKind } from '@gravity-run/game-config';
import type { QualityTier } from '../quality/detectQualityTier';

const MODEL_URL = '/assets/models/gameplay-props.glb';
const KINDS = ['spire', 'blade', 'debris', 'collapse-gate', 'fragment'] as const;

export type GameplayAssetKind = HazardKind | 'fragment';

export function gameplayAssetLodForQuality(quality: QualityTier): 0 | 1 | 2 {
  if (quality === 'compatibility') return 2;
  if (quality === 'mobile') return 1;
  return 0;
}

const REFERENCES: Readonly<Record<GameplayAssetKind, THREE.Vector3>> = Object.freeze({
  spire: new THREE.Vector3(1.2, 5.5, 1.2),
  blade: new THREE.Vector3(1.8, 1.8, 0.32),
  debris: new THREE.Vector3(1, 1, 1),
  'collapse-gate': new THREE.Vector3(1.2, 3.8, 6.5),
  fragment: new THREE.Vector3(0.55, 0.55, 0.55),
});

export class GameplayAssetLibrary {
  readonly #loader = new GLTFLoader();
  readonly #quality: QualityTier;
  readonly #prototypes = new Map<GameplayAssetKind, THREE.Group>();
  #readyPromise: Promise<void> | null = null;

  constructor(quality: QualityTier) {
    this.#quality = quality;
  }

  preload(): Promise<void> {
    if (this.#readyPromise) return this.#readyPromise;
    this.#readyPromise = this.#loader
      .loadAsync(MODEL_URL)
      .then((gltf) => {
        const lod = gameplayAssetLodForQuality(this.#quality);
        for (const kind of KINDS) {
          const category = kind === 'fragment' ? 'pickup' : 'hazard';
          const prefix = `${category}_${kind}_lod${lod}_`;
          const group = new THREE.Group();
          group.name = `${category}_${kind}_lod${lod}`;
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
      })
      .catch((error: unknown) => {
        console.warn('[Gravity Run] Gameplay props GLB unavailable; using geometric fallback.', error);
      });
    return this.#readyPromise;
  }

  has(kind: GameplayAssetKind): boolean {
    return this.#prototypes.has(kind);
  }

  create(kind: GameplayAssetKind): THREE.Group | null {
    const prototype = this.#prototypes.get(kind);
    if (!prototype) return null;
    const clone = prototype.clone(true);
    clone.userData.gameplayAssetKind = kind;
    clone.userData.referenceHalfExtents = REFERENCES[kind].clone();
    clone.traverse((object) => {
      object.userData.managedByGameplayAssetLibrary = true;
    });
    return clone;
  }

  referenceHalfExtents(kind: GameplayAssetKind): THREE.Vector3 {
    return REFERENCES[kind].clone();
  }

  dispose(): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    for (const prototype of this.#prototypes.values()) {
      prototype.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
          this.#collectTextures(material, textures);
        }
      });
    }
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    this.#prototypes.clear();
  }

  #prepareMaterial(material: THREE.Material): THREE.Material {
    const clone = material.clone();
    if (clone instanceof THREE.MeshStandardMaterial) {
      clone.envMapIntensity = 1.1;
      if (clone.emissive.getHex() !== 0) clone.emissiveIntensity = 3.1;
      clone.needsUpdate = true;
    }
    return clone;
  }

  #collectTextures(material: THREE.Material, target: Set<THREE.Texture>): void {
    const record = material as unknown as Record<string, unknown>;
    for (const value of Object.values(record)) {
      if (value instanceof THREE.Texture) target.add(value);
    }
  }
}
