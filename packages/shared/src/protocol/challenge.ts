import type { ReplaySubmission } from './replay.js';

export interface DailyChallengeManifest {
  protocol: 'gravity-run/challenge';
  version: 1;
  challengeId: string;
  date: string;
  seed: string;
  mode: 'daily';
  attemptLimit: number;
  simulationVersion: string;
  configurationHash: string;
  biome: 'shattered-vertical-city';
  expiresAt: string;
  challengeCode: string;
  signature: string;
}

export interface LeaderboardEntry {
  runId: string;
  playerName: string;
  mode: 'endless' | 'daily';
  challengeId: string | null;
  score: number;
  distance: number;
  maximumCombo: number;
  createdAt: string;
}

export interface LeaderboardResponse {
  protocol: 'gravity-run/leaderboard';
  version: 1;
  mode: LeaderboardEntry['mode'];
  challengeId: string | null;
  entries: LeaderboardEntry[];
}

export interface ReplaySubmissionRequest {
  playerId: string;
  playerName?: string;
  challenge?: DailyChallengeManifest;
  submission: ReplaySubmission;
}

export interface ReplaySubmissionResponse {
  verified: true;
  entry: LeaderboardEntry;
  rank: number;
}
