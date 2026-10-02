import { DIFFICULTY_CONFIG } from './difficulty';
import type { Difficulty } from './types';

/** Letters a player may have revealed per puzzle. */
export const MAX_HINTS = 3;
export const HINT_PENALTY = 25;

export interface ScoreInput {
  difficulty: Difficulty;
  /** Entries fully correct when the player submitted; a partly solved grid still scores. */
  correctEntries: number;
  elapsedSeconds: number;
  hintsUsed: number;
}

/**
 * base = points per word × correct entries.
 * time bonus = up to half of base, decaying linearly to zero at par time.
 * Each revealed letter costs a flat penalty. Never below zero.
 */
export function computeScore({ difficulty, correctEntries, elapsedSeconds, hintsUsed }: ScoreInput): number {
  const config = DIFFICULTY_CONFIG[difficulty];
  const base = config.pointsPerWord * correctEntries;
  const remaining = Math.max(0, 1 - Math.max(0, elapsedSeconds) / config.parSeconds);
  const timeBonus = Math.round(base * 0.5 * remaining);
  return Math.max(0, base + timeBonus - HINT_PENALTY * hintsUsed);
}
