import * as THREE from 'three';
import {
  stepCriticallyDampedSpring,
  stepCriticallyDampedVector,
  verticalFovFromHorizontal,
} from './cameraMath';

export interface CameraRigInput {
  playerPosition: THREE.Vector3;
  playerVelocity: THREE.Vector3;
  targetPosition: THREE.Vector3 | null;
  targetLocked: boolean;
  speed: number;
  aspect: number;
  reducedMotion: boolean;
  deltaSeconds: number;
}

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const FALLBACK_FORWARD = new THREE.Vector3(1, 0, 0);

export class SpringCameraRig {
  readonly #camera: THREE.PerspectiveCamera;
  readonly #positionVelocity = new THREE.Vector3();
  readonly #focus = new THREE.Vector3();
  readonly #focusVelocity = new THREE.Vector3();
  readonly #forward = new THREE.Vector3();
  readonly #right = new THREE.Vector3();
  readonly #desiredPosition = new THREE.Vector3();
  readonly #desiredFocus = new THREE.Vector3();
  #horizontalFov = 72;
  #horizontalFovVelocity = 0;
  #initialized = false;

  constructor(camera: THREE.PerspectiveCamera) {
    this.#camera = camera;
  }

  reset(playerPosition: THREE.Vector3, playerVelocity: THREE.Vector3, aspect: number): void {
    this.#basis(playerVelocity);
    this.#desiredPosition
      .copy(playerPosition)
      .addScaledVector(this.#forward, -8.5)
      .addScaledVector(WORLD_UP, 5.7)
      .addScaledVector(this.#right, 15.5);
    this.#desiredFocus.copy(playerPosition).addScaledVector(this.#forward, 6);
    this.#camera.position.copy(this.#desiredPosition);
    this.#focus.copy(this.#desiredFocus);
    this.#positionVelocity.set(0, 0, 0);
    this.#focusVelocity.set(0, 0, 0);
    this.#horizontalFov = 72;
    this.#horizontalFovVelocity = 0;
    this.#camera.fov = verticalFovFromHorizontal(this.#horizontalFov, aspect);
    this.#camera.lookAt(this.#focus);
    this.#camera.updateProjectionMatrix();
    this.#initialized = true;
  }

  update(input: CameraRigInput): void {
    if (!this.#initialized) this.reset(input.playerPosition, input.playerVelocity, input.aspect);
    this.#basis(input.playerVelocity);

    const speed01 = THREE.MathUtils.smoothstep(input.speed, 8, 42);
    const lockedDistance = input.targetLocked ? 9.4 : 8.25;
    const lateralDistance = input.reducedMotion ? 15.2 : THREE.MathUtils.lerp(15.5, 17.2, speed01);
    const verticalDistance = input.reducedMotion ? 5.8 : THREE.MathUtils.lerp(5.6, 6.8, speed01);

    this.#desiredPosition
      .copy(input.playerPosition)
      .addScaledVector(this.#forward, -lockedDistance)
      .addScaledVector(WORLD_UP, verticalDistance)
      .addScaledVector(this.#right, lateralDistance);

    this.#desiredFocus
      .copy(input.playerPosition)
      .addScaledVector(this.#forward, THREE.MathUtils.lerp(4.5, 10.5, speed01));
    if (input.targetPosition) {
      this.#desiredFocus.lerp(input.targetPosition, input.targetLocked ? 0.28 : 0.1);
    }

    stepCriticallyDampedVector(
      this.#camera.position,
      this.#positionVelocity,
      this.#desiredPosition,
      input.reducedMotion ? 0.12 : 0.2,
      input.deltaSeconds,
    );
    stepCriticallyDampedVector(
      this.#focus,
      this.#focusVelocity,
      this.#desiredFocus,
      input.reducedMotion ? 0.1 : 0.16,
      input.deltaSeconds,
    );

    const targetHorizontalFov = input.reducedMotion
      ? 72
      : 70 + speed01 * 10 - (input.targetLocked ? 2 : 0);
    const fov = stepCriticallyDampedSpring(
      { value: this.#horizontalFov, velocity: this.#horizontalFovVelocity },
      targetHorizontalFov,
      0.18,
      input.deltaSeconds,
    );
    this.#horizontalFov = fov.value;
    this.#horizontalFovVelocity = fov.velocity;
    this.#camera.fov = verticalFovFromHorizontal(this.#horizontalFov, input.aspect);
    this.#camera.up.copy(WORLD_UP);
    this.#camera.lookAt(this.#focus);
    this.#camera.updateProjectionMatrix();
  }

  #basis(velocity: THREE.Vector3): void {
    this.#forward.copy(velocity);
    if (this.#forward.lengthSq() < 1e-6) this.#forward.copy(FALLBACK_FORWARD);
    this.#forward.normalize();
    this.#right.crossVectors(this.#forward, WORLD_UP);
    if (this.#right.lengthSq() < 1e-5) this.#right.set(0, 0, 1);
    this.#right.normalize();
  }
}
