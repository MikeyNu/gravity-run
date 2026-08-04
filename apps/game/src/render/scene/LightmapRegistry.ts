import * as THREE from 'three';

// Baked GI stub — apply pre-baked lightmap textures to environment meshes
// when available, otherwise the IBL from EnvironmentProbes provides ambient shading.
// Lightmap textures are authored in a separate bake step and served from /assets/lightmaps/.

export interface LightmapEntry {
  meshNamePattern: RegExp;
  url: string;
  intensity: number;
}

const ENTRIES: readonly LightmapEntry[] = [
  { meshNamePattern: /^environment_tower/, url: '/assets/lightmaps/towers_baked.jpg', intensity: 1.2 },
  { meshNamePattern: /^environment_bridge/, url: '/assets/lightmaps/bridges_baked.jpg', intensity: 1.0 },
  { meshNamePattern: /^environment_platform/, url: '/assets/lightmaps/platforms_baked.jpg', intensity: 1.0 },
];

export class LightmapRegistry {
  readonly #cache = new Map<string, THREE.Texture>();
  readonly #loader = new THREE.TextureLoader();
  #enabled = false;

  // Load all lightmap textures speculatively; silently ignore 404s.
  async preload(): Promise<void> {
    await Promise.allSettled(
      ENTRIES.map(async (entry) => {
        try {
          const texture = await this.#loader.loadAsync(entry.url);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.flipY = false;
          this.#cache.set(entry.url, texture);
        } catch {
          // Not available — bake step hasn't run yet, use IBL only
        }
      }),
    );
    this.#enabled = this.#cache.size > 0;
  }

  apply(root: THREE.Object3D): void {
    if (!this.#enabled) return;
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const entry of ENTRIES) {
        if (!entry.meshNamePattern.test(object.name)) continue;
        const texture = this.#cache.get(entry.url);
        if (!texture) continue;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (material instanceof THREE.MeshStandardMaterial ||
              material instanceof THREE.MeshPhysicalMaterial) {
            material.lightMap = texture;
            material.lightMapIntensity = entry.intensity;
            material.needsUpdate = true;
          }
        }
      }
    });
  }

  dispose(): void {
    for (const texture of this.#cache.values()) texture.dispose();
    this.#cache.clear();
    this.#enabled = false;
  }
}
