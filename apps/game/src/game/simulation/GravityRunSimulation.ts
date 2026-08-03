import {
  courseConfig,
  movementConfig,
  type CourseModuleDefinition,
  type FragmentDefinition,
  type GravityWellDefinition,
  type HazardDefinition,
} from '@gravity-run/game-config';
import {
  add,
  clamp,
  cloneVec3,
  distance,
  dot,
  length,
  normalize,
  scale,
  subtract,
  type TickInput,
  type Vec3,
} from '@gravity-run/shared';
import type { SimulationPort } from '../core/GameRuntime';
import { distanceSquaredToSegment, sweepSphereAgainstHazards } from '../collision/sweep';
import { buildOrbitBasis, predictClosestApproach, stepConstrainedOrbit, type OrbitBasis } from '../movement/orbitMath';
import { generateCourseWindow } from '../procedural/courseGenerator';
import { ReplayRecorder } from '../replay/ReplayRecorder';
import { ScoreSystem } from '../scoring/ScoreSystem';
import { selectGravityTarget } from '../targeting/selectTarget';
import type { FailureReason, MovementPhase, SimulationSnapshot } from './types';

const START_POSITION: Vec3 = { x: 0, y: 1.5, z: 0 };
const START_VELOCITY: Vec3 = { x: 13.5, y: 1.2, z: 0 };
const FALLBACK_NORMAL: Vec3 = { x: 0, y: 0, z: 1 };
const COUNTDOWN_TICKS = 120;

export class GravityRunSimulation implements SimulationPort {
  readonly #seed: string;
  readonly #score = new ScoreSystem();
  #replay: ReplayRecorder;
  #tick = 0;
  #elapsedSeconds = 0;
  #phase: MovementPhase = 'countdown';
  #countdownTicks = COUNTDOWN_TICKS;
  #position = cloneVec3(START_POSITION);
  #velocity = cloneVec3(START_VELOCITY);
  #modules: CourseModuleDefinition[] = [];
  #wells: GravityWellDefinition[] = [];
  #hazards: HazardDefinition[] = [];
  #pickups: FragmentDefinition[] = [];
  #activeTarget: GravityWellDefinition | null = null;
  #previewTarget: GravityWellDefinition | null = null;
  #orbitBasis: OrbitBasis | null = null;
  #orbitEnergyUsed = 0;
  #latchBlendRemaining = 0;
  #releaseTicks = 0;
  #latchBufferTicks = 0;
  #recentlyUsed = new Set<string>();
  #collectedFragments = new Set<string>();
  #nearMissedHazards = new Set<string>();
  #collapseX = -courseConfig.collapseStartDistance;
  #failureReason: FailureReason = null;
  #furthestX = 0;

  constructor(seed = 'gravity-run-default') {
    this.#seed = seed;
    this.#replay = new ReplayRecorder(seed);
    this.#rebuildCourse();
  }

  reset(): void {
    this.#tick = 0;
    this.#elapsedSeconds = 0;
    this.#phase = 'countdown';
    this.#countdownTicks = COUNTDOWN_TICKS;
    this.#position = cloneVec3(START_POSITION);
    this.#velocity = cloneVec3(START_VELOCITY);
    this.#activeTarget = null;
    this.#previewTarget = null;
    this.#orbitBasis = null;
    this.#orbitEnergyUsed = 0;
    this.#latchBlendRemaining = 0;
    this.#releaseTicks = 0;
    this.#latchBufferTicks = 0;
    this.#recentlyUsed.clear();
    this.#collectedFragments.clear();
    this.#nearMissedHazards.clear();
    this.#collapseX = -courseConfig.collapseStartDistance;
    this.#failureReason = null;
    this.#furthestX = 0;
    this.#score.reset();
    this.#replay = new ReplayRecorder(this.#seed);
    this.#rebuildCourse();
  }

  step(fixedStepSeconds: number, input: TickInput): void {
    this.#tick += 1;
    this.#elapsedSeconds += fixedStepSeconds;
    this.#replay.recordInput(input);

    if (this.#phase === 'failed') {
      if (input.pressed) this.reset();
      return;
    }

    if (this.#phase === 'countdown') {
      this.#countdownTicks -= 1;
      if (this.#countdownTicks <= 0) this.#phase = 'free-flight';
      return;
    }

    this.#refreshCourseWindow();
    this.#updateTargetPreview();

    if (input.pressed) this.#latchBufferTicks = movementConfig.latchBufferTicks;
    else if (this.#latchBufferTicks > 0) this.#latchBufferTicks -= 1;

    if (this.#latchBufferTicks > 0 && this.#previewTarget && !this.#activeTarget) {
      this.#beginLatch(this.#previewTarget);
      this.#latchBufferTicks = 0;
    }

    if (input.released && this.#activeTarget && this.#orbitBasis) this.#releaseFromOrbit();

    const previousPosition = cloneVec3(this.#position);
    if (this.#activeTarget && this.#orbitBasis) this.#stepOrbit(fixedStepSeconds, input.held);
    else this.#stepFreeFlight(fixedStepSeconds);

    this.#resolveWorld(previousPosition);
    if (this.#failureReason !== null) return;

    this.#furthestX = Math.max(this.#furthestX, this.#position.x);
    this.#score.step(this.#furthestX);
    this.#stepCollapse(fixedStepSeconds);
    this.#collectFragments(previousPosition);
    this.#detectNearMisses(previousPosition);

    if (this.#releaseTicks > 0) {
      this.#releaseTicks -= 1;
      if (this.#releaseTicks === 0 && this.#phase === 'released') this.#phase = 'free-flight';
    }

    const snapshot = this.getSnapshot();
    this.#replay.recordSnapshot(snapshot);
  }

  getSnapshot(): SimulationSnapshot {
    const score = this.#score.snapshot();
    return Object.freeze({
      tick: this.#tick,
      elapsedSeconds: this.#elapsedSeconds,
      phase: this.#phase,
      playerPosition: cloneVec3(this.#position),
      playerVelocity: cloneVec3(this.#velocity),
      playerSpeed: length(this.#velocity),
      playerRadius: movementConfig.playerRadius,
      activeTargetId: this.#activeTarget?.id ?? null,
      previewTargetId: this.#previewTarget?.id ?? null,
      tetherLength: this.#orbitBasis?.radius ?? null,
      targetLocked: this.#activeTarget !== null,
      distance: Math.max(this.#furthestX, 0),
      score: score.score,
      combo: score.combo,
      maximumCombo: score.maximumCombo,
      fragments: score.fragments,
      nearMisses: score.nearMisses,
      lastReleaseGrade: score.lastReleaseGrade,
      collapseX: this.#collapseX,
      failureReason: this.#failureReason,
      countdownTicks: this.#countdownTicks,
      checksum: this.#checksum(),
      modules: this.#modules,
      wells: this.#wells,
      hazards: this.#hazards,
      pickups: this.#pickups,
      collectedFragmentIds: [...this.#collectedFragments],
    });
  }

  createReplaySubmission() {
    return this.#replay.createSubmission(this.getSnapshot());
  }

  #beginLatch(target: GravityWellDefinition): void {
    const range = distance(this.#position, target.position);
    if (range > target.acquisitionRadius) return;
    this.#activeTarget = target;
    this.#previewTarget = target;
    this.#orbitBasis = buildOrbitBasis(this.#position, target.position, this.#velocity, FALLBACK_NORMAL);
    this.#orbitBasis.radius = clamp(this.#orbitBasis.radius, target.minimumOrbitRadius, target.maximumOrbitRadius);
    this.#orbitEnergyUsed = 0;
    this.#latchBlendRemaining = movementConfig.latchBlendSeconds;
    this.#phase = 'latching';
  }

  #releaseFromOrbit(): void {
    const target = this.#activeTarget;
    const basis = this.#orbitBasis;
    if (!target || !basis) return;

    const speed = Math.min(Math.abs(basis.tangentialSpeed) + target.releaseBoost, movementConfig.maximumSpeed);
    this.#velocity = scale(basis.tangent, speed);
    const nextWell = this.#bestFutureWell(target.id);
    if (nextWell) {
      const approach = predictClosestApproach(this.#position, this.#velocity, nextWell.position, 1.2);
      const desired = normalize(subtract(nextWell.position, this.#position));
      const alignment = dot(normalize(this.#velocity), desired);
      this.#score.recordRelease(alignment, approach.distance, speed, target);
    }

    this.#recentlyUsed.add(target.id);
    if (this.#recentlyUsed.size > 5) {
      const first = this.#recentlyUsed.values().next().value as string | undefined;
      if (first) this.#recentlyUsed.delete(first);
    }
    this.#activeTarget = null;
    this.#orbitBasis = null;
    this.#orbitEnergyUsed = 0;
    this.#phase = 'released';
    this.#releaseTicks = movementConfig.releaseStateTicks;
  }

  #stepOrbit(fixedStepSeconds: number, held: boolean): void {
    const target = this.#activeTarget;
    const basis = this.#orbitBasis;
    if (!target || !basis) return;

    const remainingEnergy = Math.max(target.energyBudget - this.#orbitEnergyUsed, 0);
    const acceleration = held ? Math.min(target.orbitAcceleration, remainingEnergy / Math.max(fixedStepSeconds, 1e-6)) : 0;
    const speedMagnitude = clamp(Math.abs(basis.tangentialSpeed) + acceleration * fixedStepSeconds, movementConfig.minimumOrbitSpeed, Math.min(target.maximumTangentialSpeed, movementConfig.maximumOrbitSpeed));
    this.#orbitEnergyUsed += acceleration * fixedStepSeconds;
    const signedSpeed = basis.tangentialSpeed < 0 ? -speedMagnitude : speedMagnitude;
    const angularStep = (signedSpeed / basis.radius) * fixedStepSeconds;
    const next = stepConstrainedOrbit({
      centre: target.position,
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
    this.#orbitBasis = { ...basis, radial: next.radial, tangent: next.tangent, tangentialSpeed: signedSpeed, radialSpeed: 0 };
  }

  #stepFreeFlight(fixedStepSeconds: number): void {
    this.#velocity = add(this.#velocity, scale(movementConfig.freeFlightAcceleration, fixedStepSeconds));
    this.#velocity = scale(this.#velocity, Math.max(1 - movementConfig.linearDrag * fixedStepSeconds, 0));
    const speed = length(this.#velocity);
    if (speed > movementConfig.maximumSpeed) this.#velocity = scale(normalize(this.#velocity), movementConfig.maximumSpeed);
    this.#position = add(this.#position, scale(this.#velocity, fixedStepSeconds));
  }

  #resolveWorld(previousPosition: Vec3): void {
    const hit = sweepSphereAgainstHazards(previousPosition, this.#position, movementConfig.playerRadius + movementConfig.collisionSkin, this.#hazards);
    if (hit?.hazard.lethal) {
      this.#position = hit.point;
      this.#fail('collision');
      return;
    }
    if (this.#position.y < movementConfig.failureFloorY) this.#fail('fell');
    else if (length(this.#velocity) < movementConfig.minimumSpeed && !this.#activeTarget) this.#fail('stalled');
  }

  #stepCollapse(fixedStepSeconds: number): void {
    const speed = courseConfig.collapseBaseSpeed + this.#furthestX * courseConfig.collapseAccelerationPerMetre;
    this.#collapseX += speed * fixedStepSeconds;
    if (this.#position.x - movementConfig.playerRadius <= this.#collapseX) this.#fail('collapse');
  }

  #collectFragments(previousPosition: Vec3): void {
    for (const pickup of this.#pickups) {
      if (this.#collectedFragments.has(pickup.id)) continue;
      const threshold = pickup.radius + movementConfig.playerRadius;
      if (distanceSquaredToSegment(pickup.position, previousPosition, this.#position) <= threshold * threshold) {
        this.#collectedFragments.add(pickup.id);
        this.#score.collectFragment(pickup.value);
      }
    }
  }

  #detectNearMisses(previousPosition: Vec3): void {
    for (const hazard of this.#hazards) {
      if (this.#nearMissedHazards.has(hazard.id)) continue;
      const threshold = Math.max(hazard.halfExtents.x, hazard.halfExtents.y, hazard.halfExtents.z) + movementConfig.playerRadius + movementConfig.nearMissPadding;
      const close = distanceSquaredToSegment(hazard.position, previousPosition, this.#position) <= threshold * threshold;
      if (close && !sweepSphereAgainstHazards(previousPosition, this.#position, movementConfig.playerRadius, [hazard])) {
        this.#nearMissedHazards.add(hazard.id);
        this.#score.recordNearMiss();
      }
    }
  }

  #updateTargetPreview(): void {
    const result = selectGravityTarget({
      playerPosition: this.#position,
      playerVelocity: this.#velocity,
      currentTargetId: this.#previewTarget?.id ?? null,
      wells: this.#wells,
      recentlyUsed: this.#recentlyUsed,
    });
    this.#previewTarget = result.well;
  }

  #bestFutureWell(excludeId: string): GravityWellDefinition | null {
    let best: GravityWellDefinition | null = null;
    let bestX = Number.POSITIVE_INFINITY;
    for (const well of this.#wells) {
      if (well.id === excludeId || well.position.x <= this.#position.x + 2) continue;
      if (well.position.x < bestX) {
        best = well;
        bestX = well.position.x;
      }
    }
    return best;
  }

  #refreshCourseWindow(): void {
    const currentModule = Math.max(Math.floor(this.#position.x / courseConfig.moduleLength), 0);
    const first = Math.max(currentModule - 1, 0);
    if (this.#modules[0]?.id === first && this.#modules.length === courseConfig.activeModuleCount + courseConfig.preloadModuleCount) return;
    this.#modules = generateCourseWindow(this.#seed, first, courseConfig.activeModuleCount + courseConfig.preloadModuleCount);
    this.#flattenCourse();
  }

  #rebuildCourse(): void {
    this.#modules = generateCourseWindow(this.#seed, 0, courseConfig.activeModuleCount + courseConfig.preloadModuleCount);
    this.#flattenCourse();
  }

  #flattenCourse(): void {
    this.#wells = this.#modules.flatMap((module) => module.wells);
    this.#hazards = this.#modules.flatMap((module) => module.hazards);
    this.#pickups = this.#modules.flatMap((module) => module.fragments);
  }

  #fail(reason: Exclude<FailureReason, null>): void {
    this.#phase = 'failed';
    this.#failureReason = reason;
    this.#activeTarget = null;
    this.#orbitBasis = null;
    this.#score.breakCombo();
  }

  #checksum(): string {
    const values = [
      this.#tick,
      Math.round(this.#position.x * 1000),
      Math.round(this.#position.y * 1000),
      Math.round(this.#position.z * 1000),
      Math.round(this.#velocity.x * 1000),
      Math.round(this.#velocity.y * 1000),
      Math.round(this.#velocity.z * 1000),
      this.#score.snapshot().score,
    ];
    let hash = 2166136261;
    for (const value of values) {
      hash ^= value;
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }
}
