import type { ClueLevel, Difficulty } from './types';

export interface DifficultyConfig {
  /** Maximum grid width and height. */
  maxSize: number;
  targetWords: number;
  minWords: number;
  /** A grid must draw on at least this many fields. */
  minCategories: number;
  clueLevels: readonly ClueLevel[];
  pointsPerWord: number;
  /** Time bonus decays linearly to zero at this many seconds. */
  parSeconds: number;
}

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: { maxSize: 9, targetWords: 8, minWords: 6, minCategories: 5, clueLevels: [1], pointsPerWord: 100, parSeconds: 300 },
  medium: { maxSize: 13, targetWords: 14, minWords: 10, minCategories: 8, clueLevels: [1, 2], pointsPerWord: 150, parSeconds: 600 },
  hard: { maxSize: 15, targetWords: 20, minWords: 14, minCategories: 10, clueLevels: [2, 3], pointsPerWord: 200, parSeconds: 900 },
};
