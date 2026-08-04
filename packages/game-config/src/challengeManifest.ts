import type { DailyChallengeManifest } from '@gravity-run/shared';
import { configurationHash, simulationVersion } from './version.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface UnsignedDailyChallenge extends Omit<DailyChallengeManifest, 'signature'> {}

export function parseChallengeDate(date: string): Date {
  if (!DATE_PATTERN.test(date)) throw new Error('Challenge date must use YYYY-MM-DD.');
  const start = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== date) {
    throw new Error('Challenge date is not a valid calendar date.');
  }
  return start;
}

export function dailyChallengeSeed(date: string): string {
  parseChallengeDate(date);
  return `gravity-run:daily:${date}`;
}

export function unsignedDailyChallenge(date: string): UnsignedDailyChallenge {
  const start = parseChallengeDate(date);
  const expires = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const codeSource = date.replaceAll('-', '');
  return Object.freeze({
    protocol: 'gravity-run/challenge',
    version: 1,
    challengeId: `daily-${date}`,
    date,
    seed: dailyChallengeSeed(date),
    mode: 'daily',
    attemptLimit: 3,
    simulationVersion,
    configurationHash,
    biome: 'shattered-vertical-city',
    expiresAt: expires.toISOString(),
    challengeCode: `GR${codeSource.slice(-4)}`,
  });
}

export const developmentChallengeManifest = Object.freeze({
  ...unsignedDailyChallenge('2026-08-03'),
  signature: 'development-only',
});
