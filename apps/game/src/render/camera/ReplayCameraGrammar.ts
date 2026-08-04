import * as THREE from 'three';
import { stepCriticallyDampedVector } from './cameraMath';

export type ReplayCameraState = 'tracking' | 'orbit-wide' | 'side-pan' | 'focus-well';

interface ReplayCameraInput {
  playerPosition: THREE.Vector3;
  playerVelocity: THREE.Vector3;
  targetPosition: THREE.Vector3 | null;
  elapsedSeconds: number;
  deltaSeconds: number;
}

const CUT_INTERVAL = 8; // seconds between cinematic cuts
const ORBIT_RADIUS = 28;

/**
 * Cinematic camera grammar for replay playback.
 * Cycles through tracking, orbit, side-pan, and focus-well shots based on elapsed time.
 */
export class ReplayCameraGrammar {
  readonly #camera: THREE.PerspectiveCamera;
  readonly #positionVelocity = new THREE.Vector3();
  readonly #focus = new THREE.Vector3();
  readonly #focusVelocity = new THREE.Vector3();
  readonly #currentPosition = new THREE.Vector3();
  #state: ReplayCameraState = 'tracking';
  #stateAge = 0;
  #orbitAngle = 0;

  static readonly STATES: readonly ReplayCameraState[] = [
    'tracking',
    'orbit-wide',
    'side-pan',
    'focus-well',
  ];

  constructor(camera: THREE.PerspectiveCamera) {
    this.#camera = camera;
    this.#camera.fov = 52;
  }

  get currentState(): ReplayCameraState { return this.#state; }

  update(input: ReplayCameraInput): void {
    this.#stateAge += input.deltaSeconds;
    if (this.#stateAge >= CUT_INTERVAL) {
      this.#stateAge = 0;
      const states = ReplayCameraGrammar.STATES;
      const currentIndex = states.indexOf(this.#state);
      this.#state = states[(currentIndex + 1) % states.length] ?? 'tracking';
    }

    const target = new THREE.Vector3();
    const desired = new THREE.Vector3();

    switch (this.#state) {
      case 'tracking': {
        const vel = input.playerVelocity.clone().normalize();
        const right = new THREE.Vector3().crossVectors(vel, new THREE.Vector3(0, 1, 0)).normalize();
        desired
          .copy(input.playerPosition)
          .addScaledVector(vel, -12)
          .addScaledVector(new THREE.Vector3(0, 1, 0), 6)
          .addScaledVector(right, 14);
        target.copy(input.playerPosition).addScaledVector(vel, 8);
        this.#camera.fov = 56;
        break;
      }
      case 'orbit-wide': {
        this.#orbitAngle += input.deltaSeconds * 0.22;
        desired
          .copy(input.playerPosition)
          .add(new THREE.Vector3(
            -10 + Math.cos(this.#orbitAngle) * ORBIT_RADIUS,
            10 + Math.sin(this.#orbitAngle * 0.5) * 4,
            Math.sin(this.#orbitAngle) * ORBIT_RADIUS,
          ));
        target.copy(input.playerPosition);
        this.#camera.fov = 64;
        break;
      }
      case 'side-pan': {
        desired
          .copy(input.playerPosition)
          .add(new THREE.Vector3(0, 4, 35));
        target.copy(input.playerPosition);
        this.#camera.fov = 48;
        break;
      }
      case 'focus-well': {
        const focusPoint = input.targetPosition ?? input.playerPosition;
        desired
          .copy(focusPoint)
          .add(new THREE.Vector3(-8, 6, 18));
        target.lerp(focusPoint, 0.6);
        target.copy(focusPoint);
        this.#camera.fov = 42;
        break;
      }
    }

    if (this.#currentPosition.lengthSq() < 1e-6) {
      this.#currentPosition.copy(desired);
      this.#focus.copy(target);
    }

    stepCriticallyDampedVector(this.#currentPosition, this.#positionVelocity, desired, 0.35, input.deltaSeconds);
    stepCriticallyDampedVector(this.#focus, this.#focusVelocity, target, 0.28, input.deltaSeconds);

    this.#camera.position.copy(this.#currentPosition);
    this.#camera.up.set(0, 1, 0);
    this.#camera.lookAt(this.#focus);
    this.#camera.updateProjectionMatrix();
  }

  reset(playerPosition: THREE.Vector3): void {
    this.#currentPosition.set(0, 0, 0);
    this.#focus.copy(playerPosition);
    this.#stateAge = 0;
    this.#state = 'tracking';
    this.#orbitAngle = 0;
  }
}
