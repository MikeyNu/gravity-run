import * as THREE from 'three';

const SAMPLE_COUNT = 28;

export class PlayerTrail {
  readonly object: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  readonly #points = Array.from({ length: SAMPLE_COUNT }, () => new THREE.Vector3());
  readonly #positions = new Float32Array(SAMPLE_COUNT * 3);
  readonly #colors = new Float32Array(SAMPLE_COUNT * 3);
  readonly #geometry = new THREE.BufferGeometry();
  readonly #material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  readonly #tailColor = new THREE.Color(0x173c63);
  readonly #headColor = new THREE.Color(0x8fe8ff);
  readonly #workingColor = new THREE.Color();
  #initialized = false;
  #lastSample = new THREE.Vector3();

  constructor() {
    this.#geometry.setAttribute('position', new THREE.BufferAttribute(this.#positions, 3));
    this.#geometry.setAttribute('color', new THREE.BufferAttribute(this.#colors, 3));
    this.object = new THREE.Line(this.#geometry, this.#material);
    this.object.frustumCulled = false;
  }

  update(position: THREE.Vector3, speed: number, reducedMotion: boolean): void {
    if (!this.#initialized) {
      this.#points.forEach((point) => point.copy(position));
      this.#lastSample.copy(position);
      this.#initialized = true;
    }
    const sampleDistance = reducedMotion ? 0.58 : 0.24;
    if (position.distanceToSquared(this.#lastSample) >= sampleDistance * sampleDistance) {
      for (let index = 0; index < SAMPLE_COUNT - 1; index += 1) {
        this.#points[index].copy(this.#points[index + 1]);
      }
      this.#points[SAMPLE_COUNT - 1].copy(position);
      this.#lastSample.copy(position);
    }

    for (let index = 0; index < SAMPLE_COUNT; index += 1) {
      const point = this.#points[index];
      const t = index / (SAMPLE_COUNT - 1);
      this.#positions[index * 3] = point.x;
      this.#positions[index * 3 + 1] = point.y;
      this.#positions[index * 3 + 2] = point.z;
      this.#workingColor.copy(this.#tailColor).lerp(this.#headColor, t * t);
      this.#colors[index * 3] = this.#workingColor.r * THREE.MathUtils.lerp(0.35, 2.2, t);
      this.#colors[index * 3 + 1] = this.#workingColor.g * THREE.MathUtils.lerp(0.35, 2.2, t);
      this.#colors[index * 3 + 2] = this.#workingColor.b * THREE.MathUtils.lerp(0.35, 2.2, t);
    }
    this.#geometry.attributes.position.needsUpdate = true;
    this.#geometry.attributes.color.needsUpdate = true;
    this.#geometry.computeBoundingSphere();
    this.#material.opacity = reducedMotion ? 0.28 : THREE.MathUtils.lerp(0.36, 0.82, THREE.MathUtils.smoothstep(speed, 8, 42));
  }

  reset(position: THREE.Vector3): void {
    this.#points.forEach((point) => point.copy(position));
    this.#lastSample.copy(position);
    this.#initialized = true;
  }

  dispose(): void {
    this.#geometry.dispose();
    this.#material.dispose();
  }
}
