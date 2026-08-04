import {
  configurationHash,
  movementConfig,
  simulationVersion,
} from '@gravity-run/game-config';
import type {
  ReplaySubmission,
  TickInput,
} from '@gravity-run/shared';
import { GravityRunSimulation } from '../simulation/GravityRunSimulation.js';
import type { RunMode, SimulationSnapshot } from '../simulation/types.js';

const MAX_DURATION_TICKS = movementConfig.simulationHz * 60 * 30;
const MAX_TRANSITIONS = 12_000;
const MAX_CHECKSUMS = 1_000;
const SEED_PATTERN = /^[a-zA-Z0-9:_-]{1,128}$/;
const CHECKSUM_PATTERN = /^[a-f0-9]{8}$/;

export interface ReplayValidationOptions {
  expectedMode?: RunMode;
  expectedSeed?: string;
  allowAssisted?: boolean;
}

export interface ReplayValidationSuccess {
  valid: true;
  snapshot: SimulationSnapshot;
}

export interface ReplayValidationFailure {
  valid: false;
  reason: string;
  tick?: number;
}

export type ReplayValidationResult = ReplayValidationSuccess | ReplayValidationFailure;

export function validateReplaySubmission(
  submission: ReplaySubmission,
  options: ReplayValidationOptions = {},
): ReplayValidationResult {
  const structuralFailure = validateStructure(submission, options);
  if (structuralFailure) return structuralFailure;

  const simulation = new GravityRunSimulation({
    seed: submission.header.seed,
    mode: submission.header.mode,
    assisted: submission.header.assisted,
  });
  let transitionIndex = 0;
  let checksumIndex = 0;
  let held = false;

  for (let tick = 1; tick <= submission.clientResult.durationTicks; tick += 1) {
    let pressed = false;
    let released = false;
    while (submission.transitions[transitionIndex]?.tick === tick) {
      const transition = submission.transitions[transitionIndex]!;
      if (transition.state === 'pressed') {
        if (held) return { valid: false, reason: 'pressed transition while already held', tick };
        held = true;
        pressed = true;
      } else {
        if (!held) return { valid: false, reason: 'released transition while not held', tick };
        held = false;
        released = true;
      }
      transitionIndex += 1;
    }

    const input: TickInput = { tick, held, pressed, released };
    simulation.step(1 / movementConfig.simulationHz, input);
    const snapshot = simulation.getSnapshot();

    while (submission.stateChecksums[checksumIndex]?.tick === tick) {
      const expected = submission.stateChecksums[checksumIndex]!;
      if (snapshot.checksum !== expected.checksum) {
        return {
          valid: false,
          reason: `state checksum mismatch: expected ${expected.checksum}, received ${snapshot.checksum}`,
          tick,
        };
      }
      checksumIndex += 1;
    }

    if (snapshot.phase === 'failed' && tick < submission.clientResult.durationTicks) {
      return { valid: false, reason: 'replay continues after terminal failure', tick };
    }
  }

  if (transitionIndex !== submission.transitions.length) {
    return { valid: false, reason: 'unconsumed input transitions remain' };
  }
  if (checksumIndex !== submission.stateChecksums.length) {
    return { valid: false, reason: 'unconsumed state checksums remain' };
  }

  const snapshot = simulation.getSnapshot();
  const mismatch = compareResult(submission, snapshot);
  if (mismatch) return { valid: false, reason: mismatch, tick: snapshot.tick };
  return { valid: true, snapshot };
}

function validateStructure(
  submission: ReplaySubmission,
  options: ReplayValidationOptions,
): ReplayValidationFailure | null {
  if (!submission || typeof submission !== 'object') return { valid: false, reason: 'submission must be an object' };
  const { header, clientResult, transitions, stateChecksums } = submission;
  if (!header || !clientResult || !Array.isArray(transitions) || !Array.isArray(stateChecksums)) {
    return { valid: false, reason: 'submission is missing required replay fields' };
  }
  if (header.replayVersion !== 2) return { valid: false, reason: 'unsupported replay protocol version' };
  if (header.simulationVersion !== simulationVersion) return { valid: false, reason: 'simulation version mismatch' };
  if (header.configurationHash !== configurationHash) return { valid: false, reason: 'configuration hash mismatch' };
  if (!SEED_PATTERN.test(header.seed)) return { valid: false, reason: 'invalid replay seed' };
  if (!['endless', 'daily', 'practice'].includes(header.mode)) return { valid: false, reason: 'invalid replay mode' };
  if (options.expectedMode && header.mode !== options.expectedMode) return { valid: false, reason: 'unexpected replay mode' };
  if (options.expectedSeed && header.seed !== options.expectedSeed) return { valid: false, reason: 'unexpected replay seed' };
  if (header.assisted && options.allowAssisted === false) return { valid: false, reason: 'assisted replay is not eligible' };
  if (!Number.isFinite(Date.parse(header.startedAt))) return { valid: false, reason: 'invalid replay start timestamp' };
  if (!Number.isInteger(clientResult.durationTicks) || clientResult.durationTicks < 1 || clientResult.durationTicks > MAX_DURATION_TICKS) {
    return { valid: false, reason: 'duration tick count is outside limits' };
  }
  if (transitions.length > MAX_TRANSITIONS) return { valid: false, reason: 'transition count exceeds limit' };
  if (stateChecksums.length > MAX_CHECKSUMS) return { valid: false, reason: 'checksum count exceeds limit' };

  let previousTransitionTick = 0;
  for (const transition of transitions) {
    if (!Number.isInteger(transition.tick) || transition.tick < 1 || transition.tick > clientResult.durationTicks) {
      return { valid: false, reason: 'input transition tick is outside replay duration' };
    }
    if (transition.tick < previousTransitionTick) return { valid: false, reason: 'input transitions are not ordered' };
    if (transition.state !== 'pressed' && transition.state !== 'released') return { valid: false, reason: 'invalid input transition state' };
    previousTransitionTick = transition.tick;
  }

  let previousChecksumTick = 0;
  for (const checksum of stateChecksums) {
    if (!Number.isInteger(checksum.tick) || checksum.tick <= previousChecksumTick || checksum.tick > clientResult.durationTicks) {
      return { valid: false, reason: 'state checksums are not strictly ordered or are outside replay duration' };
    }
    if (!CHECKSUM_PATTERN.test(checksum.checksum)) return { valid: false, reason: 'invalid state checksum format' };
    previousChecksumTick = checksum.tick;
  }

  for (const value of [clientResult.score, clientResult.distance, clientResult.fragments, clientResult.maximumCombo]) {
    if (!Number.isFinite(value) || value < 0) return { valid: false, reason: 'client result contains an invalid numeric value' };
  }
  return null;
}

function compareResult(submission: ReplaySubmission, snapshot: SimulationSnapshot): string | null {
  const result = submission.clientResult;
  if (result.score !== snapshot.score) return `score mismatch: expected ${result.score}, reconstructed ${snapshot.score}`;
  if (Math.abs(result.distance - snapshot.distance) > 0.001) return `distance mismatch: expected ${result.distance}, reconstructed ${snapshot.distance}`;
  if (result.fragments !== snapshot.fragments) return `fragment mismatch: expected ${result.fragments}, reconstructed ${snapshot.fragments}`;
  if (Math.abs(result.maximumCombo - snapshot.maximumCombo) > 0.001) return `combo mismatch: expected ${result.maximumCombo}, reconstructed ${snapshot.maximumCombo}`;
  if (result.failureReason !== snapshot.failureReason) return `failure reason mismatch: expected ${result.failureReason}, reconstructed ${snapshot.failureReason}`;
  if (result.durationTicks !== snapshot.tick) return `duration mismatch: expected ${result.durationTicks}, reconstructed ${snapshot.tick}`;
  return null;
}
