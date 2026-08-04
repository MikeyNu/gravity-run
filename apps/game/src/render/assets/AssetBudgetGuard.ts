import * as THREE from 'three';

const BUDGET_BYTES: Readonly<Record<string, number>> = {
  compatibility: 32 * 1024 * 1024,
  mobile:        64 * 1024 * 1024,
  desktop:      128 * 1024 * 1024,
  cinematic:    256 * 1024 * 1024,
};

const DEFAULT_BUDGET = 128 * 1024 * 1024;

function estimateGeometryBytes(geometry: THREE.BufferGeometry): number {
  let total = 0;
  for (const attribute of Object.values(geometry.attributes)) {
    const attr = attribute as THREE.BufferAttribute;
    total += attr.array.byteLength;
  }
  if (geometry.index) total += geometry.index.array.byteLength;
  return total;
}

function estimateMaterialBytes(material: THREE.Material): number {
  let total = 0;
  const record = material as unknown as Record<string, unknown>;
  for (const value of Object.values(record)) {
    if (!(value instanceof THREE.Texture)) continue;
    const tex = value as THREE.Texture;
    if (!tex.image) continue;
    const img = tex.image as { width?: number; height?: number };
    const w = img.width ?? 0;
    const h = img.height ?? 0;
    total += Math.ceil(w * h * 4 * 1.33);
  }
  return total;
}

export function measureScene(root: THREE.Object3D): { geometryBytes: number; textureBytes: number; totalBytes: number } {
  const seenGeometries = new Set<THREE.BufferGeometry>();
  const seenMaterials = new Set<THREE.Material>();
  let geometryBytes = 0;
  let textureBytes = 0;

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const mesh = object as THREE.Mesh;

    if (!seenGeometries.has(mesh.geometry)) {
      seenGeometries.add(mesh.geometry);
      geometryBytes += estimateGeometryBytes(mesh.geometry);
    }

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (seenMaterials.has(material)) continue;
      seenMaterials.add(material);
      textureBytes += estimateMaterialBytes(material);
    }
  });

  return { geometryBytes, textureBytes, totalBytes: geometryBytes + textureBytes };
}

export function checkBudget(root: THREE.Object3D, quality: string, label: string): void {
  if (!import.meta.env.DEV) return;
  const budget = BUDGET_BYTES[quality] ?? DEFAULT_BUDGET;
  const { geometryBytes, textureBytes, totalBytes } = measureScene(root);

  const fmt = (n: number): string => `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (totalBytes > budget) {
    console.warn(
      `[AssetBudget] ${label} exceeds ${quality} budget: ` +
      `${fmt(totalBytes)} used (geo ${fmt(geometryBytes)} + tex ${fmt(textureBytes)}) ` +
      `> budget ${fmt(budget)}`,
    );
  } else {
    console.debug(
      `[AssetBudget] ${label}: ${fmt(totalBytes)} / ${fmt(budget)} ` +
      `(geo ${fmt(geometryBytes)} + tex ${fmt(textureBytes)})`,
    );
  }
}
