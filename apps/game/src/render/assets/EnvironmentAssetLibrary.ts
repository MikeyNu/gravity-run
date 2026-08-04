import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { QualityTier } from '../quality/detectQualityTier';
import type { EnvironmentAssetKind } from './environmentLayout';

const MODEL_URL = '/assets/models/city-environment-kit.glb';
const KINDS: readonly EnvironmentAssetKind[] = [
  'tower-a',
  'tower-b',
  'tower-broken',
  'bridge-straight',
  'platform-wide',
  'truss-support',
  'antenna-cluster',
  'debris-chunk-large',
  'far-cluster',
];

export interface EnvironmentLodProfile {
  highestLod: 0 | 1 | 2;
  mediumDistance: number;
  farDistance: number;
}

export function environmentLodProfile(quality: QualityTier): EnvironmentLodProfile {
  if (quality === 'compatibility') {
    return { highestLod: 2, mediumDistance: 0, farDistance: 0 };
  }
  if (quality === 'mobile') {
    return { highestLod: 1, mediumDistance: 0, farDistance: 105 };
  }
  if (quality === 'desktop') {
    return { highestLod: 0, mediumDistance: 82, farDistance: 178 };
  }
  return { highestLod: 0, mediumDistance: 118, farDistance: 246 };
}

export class EnvironmentAssetLibrary {
  readonly #loader = new GLTFLoader();
  readonly #quality: QualityTier;
  readonly #prototypes = new Map<string, THREE.Group>();
  #readyPromise: Promise<void> | null = null;
  #ready = false;

  constructor(quality: QualityTier) {
    this.#quality = quality;
  }

  get ready(): boolean {
    return this.#ready;
  }

  preload(): Promise<void> {
    if (this.#readyPromise) return this.#readyPromise;
    this.#readyPromise = this.#loader
      .loadAsync(MODEL_URL)
      .then((gltf) => {
        for (const kind of KINDS) {
          for (const lod of [0, 1, 2] as const) {
            const prefix = `environment_${kind}_lod${lod}_`;
            const group = new THREE.Group();
            group.name = `environment_${kind}_lod${lod}`;
            gltf.scene.traverse((object) => {
              if (!(object instanceof THREE.Mesh)) return;
              if (!object.name.startsWith(prefix)) return;
              if (
                object.name.endsWith('_COLLISION') ||
                object.name.endsWith('_OCCLUSION') ||
                object.name.includes('_SOCKET_')
              ) return;
              const clone = object.clone();
              clone.geometry = object.geometry;
              clone.material = Array.isArray(object.material)
                ? object.material.map((material) => this.#prepareMaterial(material))
                : this.#prepareMaterial(object.material);
              clone.castShadow = this.#quality === 'desktop' || this.#quality === 'cinematic';
              clone.receiveShadow = this.#quality !== 'compatibility';
              group.add(clone);
            });
            if (group.children.length > 0) this.#prototypes.set(`${kind}:${lod}`, group);
          }
        }
        this.#ready = KINDS.every((kind) => this.#prototypes.has(`${kind}:2`));
        if (!this.#ready) throw new Error('City environment kit is missing required LOD prototypes.');
      })
      .catch((error: unknown) => {
        this.#ready = false;
        console.warn('[Gravity Run] City environment GLB unavailable; retaining skyline fallback.', error);
      });
    return this.#readyPromise;
  }

  has(kind: EnvironmentAssetKind, lod: 0 | 1 | 2): boolean {
    return this.#prototypes.has(`${kind}:${lod}`);
  }

  create(kind: EnvironmentAssetKind): THREE.Object3D | null {
    const profile = environmentLodProfile(this.#quality);
    if (profile.highestLod === 2) return this.#cloneLevel(kind, 2);

    const lodObject = new THREE.LOD();
    lodObject.name = `environment_${kind}_runtime-lod`;
    lodObject.autoUpdate = true;

    if (profile.highestLod === 0) {
      const near = this.#cloneLevel(kind, 0);
      if (near) lodObject.addLevel(near, 0, 0.08);
    }

    const medium = this.#cloneLevel(kind, 1);
    if (medium) lodObject.addLevel(medium, profile.mediumDistance, 0.1);
    const far = this.#cloneLevel(kind, 2);
    if (far) lodObject.addLevel(far, profile.farDistance, 0.12);

    if (lodObject.levels.length === 0) return null;
    this.#markManaged(lodObject, kind);
    return lodObject;
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
    this.#ready = false;
  }

  #cloneLevel(kind: EnvironmentAssetKind, lod: 0 | 1 | 2): THREE.Group | null {
    const prototype = this.#prototypes.get(`${kind}:${lod}`);
    if (!prototype) return null;
    const clone = prototype.clone(true);
    clone.name = `${prototype.name}_instance`;
    this.#markManaged(clone, kind);
    return clone;
  }

  #markManaged(object: THREE.Object3D, kind: EnvironmentAssetKind): void {
    object.userData.environmentAssetKind = kind;
    object.traverse((child) => {
      child.userData.managedByEnvironmentAssetLibrary = true;
    });
  }

  #prepareMaterial(material: THREE.Material): THREE.Material {
    const clone = material.clone();
    if (clone instanceof THREE.MeshStandardMaterial) {
      clone.envMapIntensity = 1.05;
      clone.roughness = Math.max(clone.roughness, 0.36);
      if (clone.emissive.getHex() !== 0) clone.emissiveIntensity = 2.25;
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
