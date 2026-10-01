import { DIFFICULTY_CONFIG } from './difficulty';
import type { Difficulty } from './types';

export const WRONG_SUBMIT_PENALTY = 50;

export interface ScoreInput {
  difficulty: Difficulty;
  wordCount: number;
  elapsedSeconds: number;
  wrongSubmits: number;
}

/**
 * base = points per word × words.
 * time bonus = up to half of base, decaying linearly to zero at par time.
 * Each wrong submit costs a flat penalty. Never below zero.
 */
export function computeScore({ difficulty, wordCount, elapsedSeconds, wrongSubmits }: ScoreInput): number {
  const config = DIFFICULTY_CONFIG[difficulty];
  const base = config.pointsPerWord * wordCount;
  const remaining = Math.max(0, 1 - Math.max(0, elapsedSeconds) / config.parSeconds);
  const timeBonus = Math.round(base * 0.5 * remaining);
  return Math.max(0, base + timeBonus - WRONG_SUBMIT_PENALTY * wrongSubmits);
}
