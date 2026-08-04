import * as THREE from 'three';
import type { QualityTier } from '../quality/detectQualityTier';

export function createWorldDressing(
  scene: THREE.Scene,
  fallback: THREE.Group,
  quality: QualityTier,
): void {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 220),
    new THREE.MeshStandardMaterial({ color: 0x080a0f, roughness: 0.96 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(500, -9.5, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  const random = seededRandom(0x47525659);
  const towerCount = quality === 'compatibility' ? 54 : quality === 'mobile' ? 92 : 150;
  const towers = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x111720, roughness: 0.8, metalness: 0.28 }),
    towerCount,
  );
  populateFallbackTowers(towers, random);
  towers.receiveShadow = true;
  towers.userData.environmentFallback = true;
  fallback.add(towers);

  const debrisCount = quality === 'compatibility' ? 36 : quality === 'mobile' ? 76 : 140;
  const debris = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: 0x1b2029, roughness: 0.78, metalness: 0.32 }),
    debrisCount,
  );
  populateFallbackDebris(debris, random);
  debris.userData.environmentFallback = true;
  fallback.add(debris);

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
  singularity.add(eventHorizon, accretion, new THREE.PointLight(0xff7c43, 180, 130, 2));
  scene.add(singularity);
}

function populateFallbackTowers(towers: THREE.InstancedMesh, random: () => number): void {
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (let index = 0; index < towers.count; index += 1) {
    const side = random() < 0.5 ? -1 : 1;
    position.set(random() * 700 - 60, random() * 20 - 7, side * (22 + random() * 72));
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
}

function populateFallbackDebris(debris: THREE.InstancedMesh, random: () => number): void {
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (let index = 0; index < debris.count; index += 1) {
    position.set(random() * 620 - 40, random() * 70 - 20, (random() - 0.5) * 120);
    quaternion.setFromEuler(
      new THREE.Euler(random() * Math.PI, random() * Math.PI, random() * Math.PI),
    );
    scale.setScalar(0.35 + random() * 2.2);
    matrix.compose(position, quaternion, scale);
    debris.setMatrixAt(index, matrix);
  }
  debris.instanceMatrix.needsUpdate = true;
}

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
