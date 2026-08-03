import type { MovementConfig } from '@gravity-run/game-config';
import {
  add,
  cloneVec3,
  length,
  normalize,
  scale,
  subtract,
  type TickInput,
  type Vec3,
} from '@gravity-run/shared';
import type { SimulationPort } from '../core/GameRuntime';
import { buildOrbitBasis, stepConstrainedOrbit, type OrbitBasis } from '../movement/orbitMath';
import type { MovementPhase, SimulationSnapshot } from './types';

const INITIAL_POSITION: Vec3 = { x: -7.5, y: 0.4, z: 0 };
const INITIAL_VELOCITY: Vec3 = { x: 7.4, y: 0.35, z: 0 };
const WELL_POSITION: Vec3 = { x: 0, y: 0, z: 0 };
const FALLBACK_NORMAL: Vec3 = { x: 0, y: 0, z: 1 };

export class MovementLabSimulation implements SimulationPort {
  readonly #config: MovementConfig;

  #tick = 0;
  #elapsedSeconds = 0;
  #phase: MovementPhase = 'free-flight';
  #position = cloneVec3(INITIAL_POSITION);
  #velocity = cloneVec3(INITIAL_VELOCITY);
  #orbitBasis: OrbitBasis | null = null;
  #latchBlendRemaining = 0;
  #releasedTicks = 0;

  constructor(config: MovementConfig) {
    this.#config = config;
  }

  reset(): void {
    this.#tick = 0;
    this.#elapsedSeconds = 0;
    this.#phase = 'free-flight';
    this.#position = cloneVec3(INITIAL_POSITION);
    this.#velocity = cloneVec3(INITIAL_VELOCITY);
    this.#orbitBasis = null;
    this.#latchBlendRemaining = 0;
    this.#releasedTicks = 0;
  }

  step(fixedStepSeconds: number, input: TickInput): void {
    this.#tick += 1;
    this.#elapsedSeconds += fixedStepSeconds;

    if (this.#position.x > 10 || this.#position.y < -8 || this.#elapsedSeconds > 18) {
      this.reset();
      return;
    }

    const distanceToWell = length(subtract(this.#position, WELL_POSITION));
    const canLatch = distanceToWell <= this.#config.acquisitionRadius;

    if (input.pressed && canLatch && this.#phase !== 'orbiting') {
      this.#orbitBasis = buildOrbitBasis(
        this.#position,
        WELL_POSITION,
        this.#velocity,
        FALLBACK_NORMAL,
      );
      this.#phase = 'latching';
      this.#latchBlendRemaining = this.#config.latchBlendSeconds;
      this.#releasedTicks = 0;
    }

    if (input.released && (this.#phase === 'latching' || this.#phase === 'orbiting')) {
      this.#phase = 'released';
      this.#orbitBasis = null;
      this.#velocity = scale(
        normalize(this.#velocity),
        Math.min(length(this.#velocity) + this.#config.releaseBoost, this.#config.maximumSpeed),
      );
      this.#releasedTicks = this.#config.releaseStateTicks;
    }

    if ((this.#phase === 'latching' || this.#phase === 'orbiting') && this.#orbitBasis) {
      this.#stepOrbit(fixedStepSeconds, input.held);
      return;
    }

    this.#stepFreeFlight(fixedStepSeconds);

    if (this.#phase === 'released') {
      this.#releasedTicks -= 1;
      if (this.#releasedTicks <= 0) this.#phase = 'free-flight';
    }
  }

  getSnapshot(): SimulationSnapshot {
    return Object.freeze({
      tick: this.#tick,
      elapsedSeconds: this.#elapsedSeconds,
      phase: this.#phase,
      playerPosition: cloneVec3(this.#position),
      playerVelocity: cloneVec3(this.#velocity),
      playerSpeed: length(this.#velocity),
      wellPosition: cloneVec3(WELL_POSITION),
      tetherLength: this.#orbitBasis?.radius ?? null,
      targetLocked: this.#phase === 'latching' || this.#phase === 'orbiting',
    });
  }

  #stepOrbit(fixedStepSeconds: number, held: boolean): void {
    const basis = this.#orbitBasis;
    if (!basis) return;

    const targetTangentialSpeed = Math.min(
      Math.max(Math.abs(basis.tangentialSpeed), this.#config.minimumOrbitSpeed) +
        (held ? this.#config.orbitAcceleration * fixedStepSeconds : 0),
      this.#config.maximumOrbitSpeed,
    );

    const signedSpeed = basis.tangentialSpeed < 0 ? -targetTangentialSpeed : targetTangentialSpeed;
    const angularStep = (signedSpeed / basis.radius) * fixedStepSeconds;

    // The movement lab uses browser trigonometry for iteration only. Ranked simulation
    // will receive deterministic sine/cosine values from the authoritative kernel.
    const next = stepConstrainedOrbit({
      centre: WELL_POSITION,
      radial: basis.radial,
      tangent: basis.tangent,
      normal: basis.normal,
      radius: basis.radius,
      tangentialSpeed: signedSpeed,
      sinTheta: Math.sin(angularStep),
      cosTheta: Math.cos(angularStep),
    });

    if (this.#phase === 'latching') {
      this.#latchBlendRemaining -= fixedStepSeconds;
      if (this.#latchBlendRemaining <= 0) this.#phase = 'orbiting';
    }

    this.#position = next.position;
    this.#velocity = next.velocity;
    this.#orbitBasis = {
      ...basis,
      radial: next.radial,
      tangent: next.tangent,
      tangentialSpeed: signedSpeed,
      radialSpeed: 0,
    };
  }

  #stepFreeFlight(fixedStepSeconds: number): void {
    this.#velocity = add(
      this.#velocity,
      scale(this.#config.freeFlightAcceleration, fixedStepSeconds),
    );

    const speed = length(this.#velocity);
    if (speed > this.#config.maximumSpeed) {
      this.#velocity = scale(normalize(this.#velocity), this.#config.maximumSpeed);
    }

    this.#position = add(this.#position, scale(this.#velocity, fixedStepSeconds));
  }
}
