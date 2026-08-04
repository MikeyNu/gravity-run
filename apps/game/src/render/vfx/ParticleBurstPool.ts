import * as THREE from 'three';
import type { ReleaseGrade } from '../../game/scoring/ScoreSystem';

type BurstKind = 'release' | 'fragment' | 'near-miss' | 'failure';

interface BurstSpecification {
  count: number;
  minimumSpeed: number;
  maximumSpeed: number;
  inheritVelocity: number;
  minimumLife: number;
  maximumLife: number;
  minimumSize: number;
  maximumSize: number;
  colors: readonly THREE.Color[];
}

const RELEASE_GOOD: BurstSpecification = Object.freeze({
  count: 28, minimumSpeed: 2.5, maximumSpeed: 7, inheritVelocity: 0.24,
  minimumLife: 0.25, maximumLife: 0.52, minimumSize: 4, maximumSize: 9,
  colors: Object.freeze([new THREE.Color(0x69d8ff), new THREE.Color(0xffffff)]),
});
const RELEASE_PERFECT: BurstSpecification = Object.freeze({
  count: 42, minimumSpeed: 2.5, maximumSpeed: 10.5, inheritVelocity: 0.24,
  minimumLife: 0.25, maximumLife: 0.72, minimumSize: 4, maximumSize: 13,
  colors: Object.freeze([new THREE.Color(0xffffff), new THREE.Color(0xf5b61b), new THREE.Color(0xd35cff)]),
});
const FRAGMENT: BurstSpecification = Object.freeze({
  count: 18, minimumSpeed: 1.2, maximumSpeed: 4.2, inheritVelocity: 0.08,
  minimumLife: 0.28, maximumLife: 0.58, minimumSize: 4, maximumSize: 9,
  colors: Object.freeze([new THREE.Color(0xf5b61b), new THREE.Color(0xffeb8d)]),
});
const NEAR_MISS: BurstSpecification = Object.freeze({
  count: 22, minimumSpeed: 2.5, maximumSpeed: 7.5, inheritVelocity: -0.08,
  minimumLife: 0.18, maximumLife: 0.42, minimumSize: 3, maximumSize: 8,
  colors: Object.freeze([new THREE.Color(0xffffff), new THREE.Color(0x69d8ff)]),
});
const FAILURE: BurstSpecification = Object.freeze({
  count: 48, minimumSpeed: 2.2, maximumSpeed: 10, inheritVelocity: 0.16,
  minimumLife: 0.4, maximumLife: 0.95, minimumSize: 5, maximumSize: 14,
  colors: Object.freeze([new THREE.Color(0xff5a32), new THREE.Color(0xf5b61b), new THREE.Color(0xb432ff)]),
});

export class ParticleBurstPool {
  readonly object: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly #capacity: number;
  readonly #positions: Float32Array;
  readonly #velocities: Float32Array;
  readonly #colors: Float32Array;
  readonly #sizes: Float32Array;
  readonly #alphas: Float32Array;
  readonly #life: Float32Array;
  readonly #maxLife: Float32Array;
  readonly #geometry = new THREE.BufferGeometry();
  readonly #material: THREE.ShaderMaterial;
  readonly #working = new THREE.Vector3();
  #cursor = 0;
  #randomState = 0x47a1f21d;

  constructor(capacity: number) {
    this.#capacity = capacity;
    this.#positions = new Float32Array(capacity * 3);
    this.#velocities = new Float32Array(capacity * 3);
    this.#colors = new Float32Array(capacity * 3);
    this.#sizes = new Float32Array(capacity);
    this.#alphas = new Float32Array(capacity);
    this.#life = new Float32Array(capacity);
    this.#maxLife = new Float32Array(capacity);
    this.#geometry.setAttribute('position', new THREE.BufferAttribute(this.#positions, 3));
    this.#geometry.setAttribute('color', new THREE.BufferAttribute(this.#colors, 3));
    this.#geometry.setAttribute('aSize', new THREE.BufferAttribute(this.#sizes, 1));
    this.#geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.#alphas, 1));
    this.#material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      vertexColors: true,
      uniforms: { uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) } },
      vertexShader: `
        precision mediump float;
        in vec3 color;
        in float aSize;
        in float aAlpha;
        out vec3 vColor;
        out float vAlpha;
        uniform float uPixelRatio;
        void main() {
          vColor = color;
          vAlpha = aAlpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixelRatio * (240.0 / max(1.0, -mvPosition.z));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        precision mediump float;
        in vec3 vColor;
        in float vAlpha;
        out vec4 pc_fragColor;
        void main() {
          vec2 centred = gl_PointCoord - vec2(0.5);
          float radius = length(centred) * 2.0;
          float soft = 1.0 - smoothstep(0.35, 1.0, radius);
          pc_fragColor = vec4(vColor * 2.4, vAlpha * soft);
        }
      `,
    });
    this.object = new THREE.Points(this.#geometry, this.#material);
    this.object.frustumCulled = false;
    this.object.userData.managedVfx = true;
  }

  emit(kind: BurstKind, position: THREE.Vector3, baseVelocity: THREE.Vector3, grade: ReleaseGrade | null = null): void {
    const specification = this.#specification(kind, grade);
    for (let index = 0; index < specification.count; index += 1) {
      const particle = this.#cursor;
      this.#cursor = (this.#cursor + 1) % this.#capacity;
      const offset = particle * 3;
      this.#positions[offset] = position.x;
      this.#positions[offset + 1] = position.y;
      this.#positions[offset + 2] = position.z;
      this.#working.set(this.#signed(), this.#signed(), this.#signed()).normalize();
      const speed = specification.minimumSpeed + this.#random() * (specification.maximumSpeed - specification.minimumSpeed);
      this.#working.multiplyScalar(speed).addScaledVector(baseVelocity, specification.inheritVelocity);
      this.#velocities[offset] = this.#working.x;
      this.#velocities[offset + 1] = this.#working.y;
      this.#velocities[offset + 2] = this.#working.z;
      const color = specification.colors[Math.floor(this.#random() * specification.colors.length)] ?? specification.colors[0];
      this.#colors[offset] = color.r;
      this.#colors[offset + 1] = color.g;
      this.#colors[offset + 2] = color.b;
      const lifetime = specification.minimumLife + this.#random() * (specification.maximumLife - specification.minimumLife);
      this.#life[particle] = lifetime;
      this.#maxLife[particle] = lifetime;
      this.#sizes[particle] = specification.minimumSize + this.#random() * (specification.maximumSize - specification.minimumSize);
      this.#alphas[particle] = 1;
    }
    this.#markDirty();
  }

  update(deltaSeconds: number): void {
    const delta = THREE.MathUtils.clamp(deltaSeconds, 0, 0.05);
    let changed = false;
    for (let particle = 0; particle < this.#capacity; particle += 1) {
      if (this.#life[particle] <= 0) continue;
      changed = true;
      const offset = particle * 3;
      this.#life[particle] = Math.max(0, this.#life[particle] - delta);
      this.#velocities[offset + 1] -= 1.8 * delta;
      this.#positions[offset] += this.#velocities[offset] * delta;
      this.#positions[offset + 1] += this.#velocities[offset + 1] * delta;
      this.#positions[offset + 2] += this.#velocities[offset + 2] * delta;
      const normalized = this.#life[particle] / Math.max(this.#maxLife[particle], 1e-5);
      this.#alphas[particle] = Math.sin(Math.PI * normalized) * Math.min(1, normalized * 3);
      if (this.#life[particle] === 0) this.#alphas[particle] = 0;
    }
    if (changed) this.#markDirty();
  }

  reset(): void {
    this.#life.fill(0);
    this.#alphas.fill(0);
    this.#markDirty();
  }

  dispose(): void {
    this.#geometry.dispose();
    this.#material.dispose();
  }

  #specification(kind: BurstKind, grade: ReleaseGrade | null): BurstSpecification {
    if (kind === 'fragment') return FRAGMENT;
    if (kind === 'near-miss') return NEAR_MISS;
    if (kind === 'failure') return FAILURE;
    return grade === 'perfect' || grade === 'overdrive' ? RELEASE_PERFECT : RELEASE_GOOD;
  }

  #markDirty(): void {
    this.#geometry.attributes.position.needsUpdate = true;
    this.#geometry.attributes.color.needsUpdate = true;
    this.#geometry.attributes.aSize.needsUpdate = true;
    this.#geometry.attributes.aAlpha.needsUpdate = true;
  }

  #random(): number {
    this.#randomState = Math.imul(this.#randomState ^ (this.#randomState >>> 15), 1 | this.#randomState);
    this.#randomState ^= this.#randomState + Math.imul(this.#randomState ^ (this.#randomState >>> 7), 61 | this.#randomState);
    return ((this.#randomState ^ (this.#randomState >>> 14)) >>> 0) / 4294967296;
  }

  #signed(): number {
    return this.#random() * 2 - 1;
  }
}
