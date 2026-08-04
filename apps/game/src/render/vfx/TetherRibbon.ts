import * as THREE from 'three';

const SEGMENTS = 18;
const SIDES = 4;
const VERTICES = (SEGMENTS + 1) * SIDES;

export class TetherRibbon {
  readonly object: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly #positions = new Float32Array(VERTICES * 3);
  readonly #colors = new Float32Array(VERTICES * 3);
  readonly #alphas = new Float32Array(VERTICES);
  readonly #geometry = new THREE.BufferGeometry();
  readonly #material: THREE.ShaderMaterial;
  readonly #curvePoint = new THREE.Vector3();
  readonly #nextCurvePoint = new THREE.Vector3();
  readonly #vertexPoint = new THREE.Vector3();
  readonly #tangent = new THREE.Vector3();
  readonly #view = new THREE.Vector3();
  readonly #side = new THREE.Vector3();
  readonly #mid = new THREE.Vector3();
  readonly #control = new THREE.Vector3();
  readonly #cyan = new THREE.Color(0x69d8ff);
  readonly #hot = new THREE.Color(0xff7a3d);
  readonly #color = new THREE.Color();

  constructor() {
    const indices: number[] = [];
    for (let segment = 0; segment < SEGMENTS; segment += 1) {
      const row = segment * SIDES;
      const nextRow = row + SIDES;
      for (let strip = 0; strip < SIDES - 1; strip += 1) {
        const a = row + strip;
        const b = a + 1;
        const c = nextRow + strip;
        const d = c + 1;
        indices.push(a, c, b, c, d, b);
      }
    }
    this.#geometry.setIndex(indices);
    this.#geometry.setAttribute('position', new THREE.BufferAttribute(this.#positions, 3));
    this.#geometry.setAttribute('color', new THREE.BufferAttribute(this.#colors, 3));
    this.#geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.#alphas, 1));
    this.#material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      vertexColors: true,
      side: THREE.DoubleSide,
      uniforms: { uOpacity: { value: 0 } },
      vertexShader: `
        attribute vec3 color;
        attribute float aAlpha;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vAlpha = aAlpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(vColor * 2.8, vAlpha * uOpacity);
        }
      `,
    });
    this.object = new THREE.Mesh(this.#geometry, this.#material);
    this.object.frustumCulled = false;
    this.object.visible = false;
    this.object.userData.managedVfx = true;
  }

  update(
    start: THREE.Vector3,
    end: THREE.Vector3 | null,
    cameraPosition: THREE.Vector3,
    tension: number,
    active: boolean,
  ): void {
    if (!end || !active) {
      this.object.visible = false;
      this.#material.uniforms.uOpacity.value = 0;
      return;
    }
    this.object.visible = true;
    const clampedTension = THREE.MathUtils.clamp(tension, 0, 1);
    this.#mid.copy(start).lerp(end, 0.5);
    const distance = start.distanceTo(end);
    this.#control.copy(this.#mid);
    this.#control.y -= distance * THREE.MathUtils.lerp(0.085, 0.018, clampedTension);

    for (let index = 0; index <= SEGMENTS; index += 1) {
      const t = index / SEGMENTS;
      const nextT = Math.min(1, t + 1 / SEGMENTS);
      this.#quadratic(start, this.#control, end, t, this.#curvePoint);
      this.#quadratic(start, this.#control, end, nextT, this.#nextCurvePoint);
      this.#tangent.copy(this.#nextCurvePoint).sub(this.#curvePoint).normalize();
      this.#view.copy(cameraPosition).sub(this.#curvePoint).normalize();
      this.#side.crossVectors(this.#tangent, this.#view);
      if (this.#side.lengthSq() < 1e-6) this.#side.set(0, 1, 0);
      this.#side.normalize();
      const longitudinalFade = Math.sin(Math.PI * t);
      const outerWidth = THREE.MathUtils.lerp(0.022, 0.08, longitudinalFade) * THREE.MathUtils.lerp(0.85, 1.25, clampedTension);
      const innerWidth = outerWidth * 0.44;
      this.#color.copy(this.#cyan).lerp(this.#hot, clampedTension * 0.82);
      const intensity = THREE.MathUtils.lerp(0.65, 1.25, longitudinalFade);
      const offsets = [-outerWidth, -innerWidth, innerWidth, outerWidth];
      const edgeAlpha = [0, longitudinalFade, longitudinalFade, 0];

      for (let sideIndex = 0; sideIndex < SIDES; sideIndex += 1) {
        const vertex = index * SIDES + sideIndex;
        this.#vertexPoint.copy(this.#curvePoint).addScaledVector(this.#side, offsets[sideIndex]);
        this.#positions[vertex * 3] = this.#vertexPoint.x;
        this.#positions[vertex * 3 + 1] = this.#vertexPoint.y;
        this.#positions[vertex * 3 + 2] = this.#vertexPoint.z;
        this.#colors[vertex * 3] = this.#color.r * intensity;
        this.#colors[vertex * 3 + 1] = this.#color.g * intensity;
        this.#colors[vertex * 3 + 2] = this.#color.b * intensity;
        this.#alphas[vertex] = edgeAlpha[sideIndex];
      }
    }
    this.#geometry.attributes.position.needsUpdate = true;
    this.#geometry.attributes.color.needsUpdate = true;
    this.#geometry.attributes.aAlpha.needsUpdate = true;
    this.#geometry.computeBoundingSphere();
    this.#material.uniforms.uOpacity.value = THREE.MathUtils.lerp(0.72, 0.96, clampedTension);
  }

  dispose(): void {
    this.#geometry.dispose();
    this.#material.dispose();
  }

  #quadratic(
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    t: number,
    target: THREE.Vector3,
  ): void {
    const oneMinus = 1 - t;
    target
      .copy(a)
      .multiplyScalar(oneMinus * oneMinus)
      .addScaledVector(b, 2 * oneMinus * t)
      .addScaledVector(c, t * t);
  }
}
