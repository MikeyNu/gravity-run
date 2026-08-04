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
import { distanceSquaredToSegment, sweepSphereAgainstHazards } from '../collision/sweep.js';
import { buildOrbitBasis, deterministicSinCos, predictClosestApproach, stepConstrainedOrbit, type OrbitBasis } from '../movement/orbitMath.js';
import { generateCourseWindow } from '../procedural/courseGenerator.js';
import { buildRouteGraph, type RouteGraph } from '../routing/RouteGraph.js';
import { ReplayRecorder } from '../replay/ReplayRecorder.js';
import { RecoveryFairnessSystem } from '../scoring/RecoveryFairnessSystem.js';
import { ScoreSystem } from '../scoring/ScoreSystem.js';
import { selectGravityTarget } from '../targeting/selectTarget.js';
import type { FailureReason, MovementPhase, RunConfiguration, RunMode, SimulationSnapshot } from './types.js';

const START_POSITION: Vec3 = { x: 0, y: 1.5, z: 0 };
const START_VELOCITY: Vec3 = { x: 13.5, y: 1.2, z: 0 };
const COUNTDOWN_TICKS = 120;
const REBASE_PERIOD = 256;

export class GravityRunSimulation {
  #seed: string;
  #mode: RunMode;
  #assisted: boolean;
  readonly #score = new ScoreSystem();
  readonly #fairness = new RecoveryFairnessSystem();
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
  #latchBlendRemaining = 0;
  #releaseTicks = 0;
  #latchBufferTicks = 0;
  #releaseBufferTicks = 0;
  #recentlyUsed = new Set<string>();
  #blockedTargetIds = new Set<string>();
  #wellEnergyUsed = new Map<string, number>();
  #collectedFragments = new Set<string>();
  #nearMissedHazards = new Set<string>();
  #collapseX = -courseConfig.collapseStartDistance;
  #failureReason: FailureReason = null;
  #furthestX = 0;
  #hazardBasePositions = new Map<string, Vec3>();
  #routeGraph: RouteGraph = { successors: () => [], isDeadEnd: () => false, forwardDepth: () => 0 };

  constructor(configuration: string | RunConfiguration = 'gravity-run-default') {
    const resolved = typeof configuration === 'string'
      ? { seed: configuration, mode: 'endless' as const, assisted: false }
      : configuration;
    this.#seed = resolved.seed;
    this.#mode = resolved.mode;
    this.#assisted = resolved.assisted ?? false;
    this.#replay = new ReplayRecorder({ seed: this.#seed, mode: this.#mode, assisted: this.#assisted });
    this.#rebuildCourse();
  }

  configure(configuration: RunConfiguration): void {
    this.#seed = configuration.seed;
    this.#mode = configuration.mode;
    this.#assisted = configuration.assisted ?? false;
    this.reset();
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
    this.#latchBlendRemaining = 0;
    this.#releaseTicks = 0;
    this.#latchBufferTicks = 0;
    this.#releaseBufferTicks = 0;
    this.#recentlyUsed.clear();
    this.#blockedTargetIds.clear();
    this.#wellEnergyUsed.clear();
    this.#collectedFragments.clear();
    this.#nearMissedHazards.clear();
    this.#collapseX = -courseConfig.collapseStartDistance;
    this.#failureReason = null;
    this.#furthestX = 0;
    this.#score.reset();
    this.#fairness.reset();
    this.#replay = new ReplayRecorder({ seed: this.#seed, mode: this.#mode, assisted: this.#assisted });
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
    this.#stepKinematicHazards();
    this.#rearmReleasedWells();
    this.#updateTargetPreview();

    if (input.pressed) this.#latchBufferTicks = movementConfig.latchBufferTicks;
    else if (this.#latchBufferTicks > 0) this.#latchBufferTicks -= 1;

    if (input.released && !this.#activeTarget) {
      this.#releaseBufferTicks = movementConfig.releaseCoyoteTicks;
    } else if (this.#releaseBufferTicks > 0) {
      this.#releaseBufferTicks -= 1;
    }

    if (input.released && this.#activeTarget && this.#orbitBasis) {
      this.#releaseFromOrbit(false);
    } else if (
      !this.#activeTarget &&
      this.#previewTarget &&
      (input.held || this.#latchBufferTicks > 0 || this.#releaseBufferTicks > 0)
    ) {
      const latched = this.#beginLatch(this.#previewTarget);
      if (latched) {
        this.#latchBufferTicks = 0;
        if (this.#releaseBufferTicks > 0) {
          this.#releaseBufferTicks = 0;
          this.#releaseFromOrbit(true);
        }
      }
    }

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
    const worldOriginX = Math.floor(this.#furthestX / REBASE_PERIOD) * REBASE_PERIOD;
    return Object.freeze({
      tick: this.#tick,
      elapsedSeconds: this.#elapsedSeconds,
      phase: this.#phase,
      playerPosition: { x: this.#position.x - worldOriginX, y: this.#position.y, z: this.#position.z },
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
      collapseX: this.#collapseX - worldOriginX,
      failureReason: this.#failureReason,
      countdownTicks: this.#countdownTicks,
      checksum: this.#checksum(),
      worldOriginX,
      modules: this.#modules,
      wells: this.#wells,
      hazards: this.#hazards,
      pickups: this.#pickups,
      collectedFragmentIds: [...this.#collectedFragments],
      targetIsDeadEnd: this.#routeGraph.isDeadEnd(
        (this.#activeTarget ?? this.#previewTarget)?.id ?? '',
      ),
    });
  }

  createReplaySubmission() {
    return this.#replay.createSubmission(this.getSnapshot());
  }

  #beginLatch(target: GravityWellDefinition): boolean {
    if (this.#blockedTargetIds.has(target.id)) return false;
    const range = distance(this.#position, target.position);
    if (range > target.latchRadius) return false;
    if (
      sweepSphereAgainstHazards(
        this.#position,
        target.position,
        movementConfig.playerRadius,
        this.#hazards,
      )?.hazard.lethal
    ) {
      return false;
    }

    this.#activeTarget = target;
    this.#previewTarget = target;
    this.#orbitBasis = buildOrbitBasis(
      this.#position,
      target.position,
      this.#velocity,
      target.routeDirection,
    );
    this.#orbitBasis.radius = clamp(
      this.#orbitBasis.radius,
      target.minimumOrbitRadius,
      target.maximumOrbitRadius,
    );
    this.#latchBlendRemaining = movementConfig.latchBlendSeconds;
    this.#phase = 'latching';
    return true;
  }

  #releaseFromOrbit(coyoteRelease: boolean): void {
    const target = this.#activeTarget;
    const basis = this.#orbitBasis;
    if (!target || !basis) return;

    const tangentialSpeed = Math.min(
      Math.abs(basis.tangentialSpeed) + target.releaseBoost,
      movementConfig.maximumSpeed,
    );
    const signedTangentialSpeed = basis.tangentialSpeed < 0
      ? -tangentialSpeed
      : tangentialSpeed;
    const radialRetention = coyoteRelease ? 1 : movementConfig.radialReleaseRetention;
    this.#velocity = add(
      scale(basis.tangent, signedTangentialSpeed),
      scale(basis.radial, basis.radialSpeed * radialRetention),
    );
    const releaseSpeed = length(this.#velocity);
    if (releaseSpeed > movementConfig.maximumSpeed) {
      this.#velocity = scale(normalize(this.#velocity), movementConfig.maximumSpeed);
    }

    const speed = length(this.#velocity);
    const nextWell = this.#bestFutureWell(target.id);
    if (nextWell) {
      const approach = predictClosestApproach(
        this.#position,
        this.#velocity,
        nextWell.position,
        1.2,
      );
      const desired = normalize(subtract(nextWell.position, this.#position));
      const alignment = dot(normalize(this.#velocity), desired);
      this.#score.recordRelease(alignment, approach.distance, speed, target);
    }

    this.#recentlyUsed.add(target.id);
    this.#blockedTargetIds.add(target.id);
    if (this.#recentlyUsed.size > 5) {
      const first = this.#recentlyUsed.values().next().value as string | undefined;
      if (first) this.#recentlyUsed.delete(first);
    }

    this.#activeTarget = null;
    this.#orbitBasis = null;
    this.#phase = 'released';
    this.#releaseTicks = movementConfig.releaseStateTicks;
  }

  #stepOrbit(fixedStepSeconds: number, held: boolean): void {
    const target = this.#activeTarget;
    const basis = this.#orbitBasis;
    if (!target || !basis) return;

    const energyUsed = this.#wellEnergyUsed.get(target.id) ?? 0;
    const remainingEnergy = Math.max(target.energyBudget - energyUsed, 0);
    const acceleration = held
      ? Math.min(
          target.orbitAcceleration,
          remainingEnergy / Math.max(fixedStepSeconds, 1e-6),
        )
      : 0;
    const speedMagnitude = clamp(
      Math.abs(basis.tangentialSpeed) + acceleration * fixedStepSeconds,
      movementConfig.minimumOrbitSpeed,
      Math.min(target.maximumTangentialSpeed, movementConfig.maximumOrbitSpeed),
    );
    this.#wellEnergyUsed.set(target.id, energyUsed + acceleration * fixedStepSeconds);

    const signedSpeed = basis.tangentialSpeed < 0 ? -speedMagnitude : speedMagnitude;
    const angularStep = (signedSpeed / basis.radius) * fixedStepSeconds;
    const trig = deterministicSinCos(angularStep);

    let radialSpeed = basis.radialSpeed;
    let radius = basis.radius;
    if (this.#phase === 'latching') {
      const previousRemaining = Math.max(this.#latchBlendRemaining, fixedStepSeconds);
      this.#latchBlendRemaining = Math.max(
        this.#latchBlendRemaining - fixedStepSeconds,
        0,
      );
      radialSpeed *= this.#latchBlendRemaining / previousRemaining;
      radius = clamp(
        radius + radialSpeed * fixedStepSeconds,
        target.minimumOrbitRadius,
        target.maximumOrbitRadius,
      );
      if (this.#latchBlendRemaining <= 0) {
        radialSpeed = 0;
        this.#phase = 'orbiting';
      }
    } else {
      radialSpeed = 0;
    }

    const next = stepConstrainedOrbit({
      centre: target.position,
      radial: basis.radial,
      tangent: basis.tangent,
      normal: basis.normal,
      radius,
      tangentialSpeed: signedSpeed,
      radialSpeed,
      sinTheta: trig.sin,
      cosTheta: trig.cos,
    });

    this.#position = next.position;
    this.#velocity = next.velocity;
    this.#orbitBasis = {
      ...basis,
      radial: next.radial,
      tangent: next.tangent,
      radius,
      tangentialSpeed: signedSpeed,
      radialSpeed,
    };
  }

  #stepFreeFlight(fixedStepSeconds: number): void {
    this.#velocity = add(
      this.#velocity,
      scale(movementConfig.freeFlightAcceleration, fixedStepSeconds),
    );
    this.#velocity = scale(
      this.#velocity,
      Math.max(1 - movementConfig.linearDrag * fixedStepSeconds, 0),
    );
    const speed = length(this.#velocity);
    if (speed > movementConfig.maximumSpeed) {
      this.#velocity = scale(normalize(this.#velocity), movementConfig.maximumSpeed);
    }
    this.#position = add(this.#position, scale(this.#velocity, fixedStepSeconds));
  }

  #resolveWorld(previousPosition: Vec3): void {
    const hit = sweepSphereAgainstHazards(
      previousPosition,
      this.#position,
      movementConfig.playerRadius + movementConfig.collisionSkin,
      this.#hazards,
    );
    if (hit?.hazard.lethal) {
      this.#position = hit.point;
      this.#fail('collision');
      return;
    }
    if (hit) {
      this.#position = add(
        hit.point,
        scale(hit.normal, movementConfig.collisionSkin),
      );
      const inwardSpeed = dot(this.#velocity, hit.normal);
      if (inwardSpeed < 0) {
        this.#velocity = subtract(
          this.#velocity,
          scale(hit.normal, inwardSpeed),
        );
      }
      this.#score.breakCombo();
    }

    if (this.#position.y < movementConfig.failureFloorY) this.#fail('fell');
    else if (length(this.#velocity) < movementConfig.minimumSpeed && !this.#activeTarget) {
      this.#fail('stalled');
    }
  }

  #stepCollapse(fixedStepSeconds: number): void {
    const speed =
      courseConfig.collapseBaseSpeed +
      this.#furthestX * courseConfig.collapseAccelerationPerMetre;
    this.#collapseX += speed * fixedStepSeconds;
    if (this.#position.x - movementConfig.playerRadius <= this.#collapseX) {
      this.#fail('collapse');
    }
  }

  #collectFragments(previousPosition: Vec3): void {
    for (const pickup of this.#pickups) {
      if (this.#collectedFragments.has(pickup.id)) continue;
      const threshold = pickup.radius + movementConfig.playerRadius;
      if (
        distanceSquaredToSegment(pickup.position, previousPosition, this.#position) <=
        threshold * threshold
      ) {
        this.#collectedFragments.add(pickup.id);
        this.#score.collectFragment(pickup.value);
      }
    }
  }

  #detectNearMisses(previousPosition: Vec3): void {
    for (const hazard of this.#hazards) {
      if (this.#nearMissedHazards.has(hazard.id)) continue;
      const threshold =
        Math.max(hazard.halfExtents.x, hazard.halfExtents.y, hazard.halfExtents.z) +
        movementConfig.playerRadius +
        movementConfig.nearMissPadding;
      const close =
        distanceSquaredToSegment(hazard.position, previousPosition, this.#position) <=
        threshold * threshold;
      if (
        close &&
        !sweepSphereAgainstHazards(previousPosition, this.#position, movementConfig.playerRadius, [hazard])
      ) {
        this.#nearMissedHazards.add(hazard.id);
        this.#score.recordNearMiss();
      }
    }
  }

  #updateTargetPreview(): void {
    this.#fairness.update(length(this.#velocity), this.#position.y);
    const result = selectGravityTarget({
      playerPosition: this.#position,
      playerVelocity: this.#velocity,
      currentTargetId: this.#previewTarget?.id ?? null,
      wells: this.#wells,
      hazards: this.#hazards,
      recentlyUsed: this.#recentlyUsed,
      excludedWellIds: this.#blockedTargetIds,
      playerRadius: movementConfig.playerRadius,
      recoveryBias: this.#fairness.recoveryBias,
    });

    // Target-skip validation: in assisted mode, prefer a well with forward successors over a dead-end.
    if (this.#assisted && result.well && this.#routeGraph.isDeadEnd(result.well.id)) {
      const alternate = selectGravityTarget({
        playerPosition: this.#position,
        playerVelocity: this.#velocity,
        currentTargetId: this.#previewTarget?.id ?? null,
        wells: this.#wells.filter((w) => !this.#routeGraph.isDeadEnd(w.id)),
        hazards: this.#hazards,
        recentlyUsed: this.#recentlyUsed,
        excludedWellIds: this.#blockedTargetIds,
        playerRadius: movementConfig.playerRadius,
      });
      this.#previewTarget = alternate.well ?? result.well;
    } else {
      this.#previewTarget = result.well;
    }
  }

  #bestFutureWell(excludeId: string): GravityWellDefinition | null {
    let best: GravityWellDefinition | null = null;
    let bestX = Number.POSITIVE_INFINITY;
    for (const well of this.#wells) {
      if (
        well.id === excludeId ||
        this.#blockedTargetIds.has(well.id) ||
        well.position.x <= this.#position.x + 2
      ) {
        continue;
      }
      if (well.position.x < bestX) {
        best = well;
        bestX = well.position.x;
      }
    }
    return best;
  }

  #rearmReleasedWells(): void {
    for (const id of this.#blockedTargetIds) {
      const well = this.#wells.find((candidate) => candidate.id === id);
      if (
        !well ||
        this.#position.x > well.position.x + movementConfig.releasedWellRearmDistance
      ) {
        this.#blockedTargetIds.delete(id);
      }
    }
  }

  #refreshCourseWindow(): void {
    const currentModule = Math.max(
      Math.floor(this.#position.x / courseConfig.moduleLength),
      0,
    );
    const first = Math.max(currentModule - 1, 0);
    if (
      this.#modules[0]?.id === first &&
      this.#modules.length === courseConfig.activeModuleCount + courseConfig.preloadModuleCount
    ) {
      return;
    }
    this.#modules = generateCourseWindow(
      this.#seed,
      first,
      courseConfig.activeModuleCount + courseConfig.preloadModuleCount,
    );
    this.#flattenCourse();
  }

  #rebuildCourse(): void {
    this.#modules = generateCourseWindow(
      this.#seed,
      0,
      courseConfig.activeModuleCount + courseConfig.preloadModuleCount,
    );
    this.#flattenCourse();
  }

  #flattenCourse(): void {
    this.#wells = this.#modules.flatMap((module) => module.wells);
    this.#hazards = this.#modules.flatMap((module) =>
      module.hazards.map((h) => ({ ...h, position: { ...h.position } }))
    );
    this.#hazardBasePositions = new Map(
      this.#hazards.map((h) => [h.id, { x: h.position.x, y: h.position.y, z: h.position.z }])
    );
    this.#pickups = this.#modules.flatMap((module) => module.fragments);
    this.#routeGraph = buildRouteGraph(this.#wells, movementConfig);

    const wellIds = new Set(this.#wells.map((well) => well.id));
    const hazardIds = new Set(this.#hazards.map((hazard) => hazard.id));
    const pickupIds = new Set(this.#pickups.map((pickup) => pickup.id));

    for (const id of this.#recentlyUsed) {
      if (!wellIds.has(id)) this.#recentlyUsed.delete(id);
    }
    for (const id of this.#blockedTargetIds) {
      if (!wellIds.has(id)) this.#blockedTargetIds.delete(id);
    }
    for (const id of this.#wellEnergyUsed.keys()) {
      if (!wellIds.has(id)) this.#wellEnergyUsed.delete(id);
    }
    for (const id of this.#nearMissedHazards) {
      if (!hazardIds.has(id)) this.#nearMissedHazards.delete(id);
    }
    for (const id of this.#collectedFragments) {
      if (!pickupIds.has(id)) this.#collectedFragments.delete(id);
    }
  }

  #stepKinematicHazards(): void {
    const t = this.#elapsedSeconds;
    const TAU = Math.PI * 2;
    for (const h of this.#hazards) {
      if (h.motion.kind === 'static') continue;
      const base = this.#hazardBasePositions.get(h.id);
      if (!base) continue;
      const m = h.motion;
      if (m.kind === 'oscillate' || m.kind === 'pendulum') {
        const offset = m.amplitude * Math.sin(TAU * t / m.period + m.phase);
        h.position.x = base.x + (m.axis === 'x' ? offset : 0);
        h.position.y = base.y + (m.axis === 'y' ? offset : 0);
        h.position.z = base.z + (m.axis === 'z' ? offset : 0);
      }
      // 'rotate' kind: AABB is pre-expanded to bounding sphere at generation time; position is static
    }
  }

  #fail(reason: Exclude<FailureReason, null>): void {
    this.#phase = 'failed';
    this.#failureReason = reason;
    this.#activeTarget = null;
    this.#orbitBasis = null;
    this.#score.breakCombo();
  }

  #checksum(): string {
    const energyTotal = [...this.#wellEnergyUsed.values()].reduce(
      (sum, value) => sum + Math.round(value * 1000),
      0,
    );
    const values = [
      this.#tick,
      Math.round(this.#position.x * 1000),
      Math.round(this.#position.y * 1000),
      Math.round(this.#position.z * 1000),
      Math.round(this.#velocity.x * 1000),
      Math.round(this.#velocity.y * 1000),
      Math.round(this.#velocity.z * 1000),
      this.#score.snapshot().score,
      Math.round(this.#collapseX * 1000),
      this.#blockedTargetIds.size,
      energyTotal,
    ];
    let hash = 2166136261;
    for (const value of values) {
      hash ^= value;
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }
}
