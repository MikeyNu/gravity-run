import * as THREE from 'three';

interface LineSeed {
  lateral: number;
  vertical: number;
  depth: number;
  lengthScale: number;
}

function random01(state: { value: number }): number {
  state.value = Math.imul(state.value ^ (state.value >>> 15), 1 | state.value);
  state.value ^= state.value + Math.imul(state.value ^ (state.value >>> 7), 61 | state.value);
  return ((state.value ^ (state.value >>> 14)) >>> 0) / 4294967296;
}

export class SpeedLineField {
  readonly object: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  readonly #seeds: LineSeed[];
  readonly #positions: Float32Array;
  readonly #geometry = new THREE.BufferGeometry();
  readonly #material = new THREE.LineBasicMaterial({
    color: 0xbceeff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  readonly #forward = new THREE.Vector3();
  readonly #right = new THREE.Vector3();
  readonly #up = new THREE.Vector3(0, 1, 0);
  readonly #point = new THREE.Vector3();

  constructor(count: number) {
    const state = { value: 0x6d2b79f5 };
    this.#seeds = Array.from({ length: count }, () => ({
      lateral: THREE.MathUtils.lerp(-13, 13, random01(state)),
      vertical: THREE.MathUtils.lerp(-8, 10, random01(state)),
      depth: THREE.MathUtils.lerp(4, 64, random01(state)),
      lengthScale: THREE.MathUtils.lerp(0.55, 1.35, random01(state)),
    }));
    this.#positions = new Float32Array(count * 2 * 3);
    this.#geometry.setAttribute('position', new THREE.BufferAttribute(this.#positions, 3));
    this.object = new THREE.LineSegments(this.#geometry, this.#material);
    this.object.frustumCulled = false;
  }

  update(player: THREE.Vector3, velocity: THREE.Vector3, speed: number, reducedMotion: boolean): void {
    const speed01 = THREE.MathUtils.smoothstep(speed, 12, 42);
    this.object.visible = speed01 > 0.06 && !reducedMotion;
    if (!this.object.visible) {
      this.#material.opacity = 0;
      return;
    }
    this.#forward.copy(velocity).normalize();
    if (this.#forward.lengthSq() < 1e-6) this.#forward.set(1, 0, 0);
    this.#right.crossVectors(this.#forward, this.#up).normalize();
    if (this.#right.lengthSq() < 1e-6) this.#right.set(0, 0, 1);
    const lineLength = THREE.MathUtils.lerp(0.8, 7.5, speed01);

    this.#seeds.forEach((seed, index) => {
      this.#point
        .copy(player)
        .addScaledVector(this.#forward, seed.depth)
        .addScaledVector(this.#right, seed.lateral)
        .addScaledVector(this.#up, seed.vertical);
      const offset = index * 6;
      this.#positions[offset] = this.#point.x;
      this.#positions[offset + 1] = this.#point.y;
      this.#positions[offset + 2] = this.#point.z;
      this.#point.addScaledVector(this.#forward, -lineLength * seed.lengthScale);
      this.#positions[offset + 3] = this.#point.x;
      this.#positions[offset + 4] = this.#point.y;
      this.#positions[offset + 5] = this.#point.z;
    });
    this.#geometry.attributes.position.needsUpdate = true;
    this.#geometry.computeBoundingSphere();
    this.#material.opacity = THREE.MathUtils.lerp(0.08, 0.42, speed01);
  }

  dispose(): void {
    this.#geometry.dispose();
    this.#material.dispose();
  }
}
