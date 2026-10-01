import { describe, expect, it } from 'vitest';
import { computeScore, WRONG_SUBMIT_PENALTY } from './scoring';

describe('computeScore', () => {
  it('gives full time bonus for an instant solve', () => {
    expect(computeScore({ difficulty: 'easy', wordCount: 8, elapsedSeconds: 0, wrongSubmits: 0 })).toBe(1200);
  });

  it('gives no time bonus at or beyond par time', () => {
    expect(computeScore({ difficulty: 'easy', wordCount: 8, elapsedSeconds: 300, wrongSubmits: 0 })).toBe(800);
    expect(computeScore({ difficulty: 'easy', wordCount: 8, elapsedSeconds: 9999, wrongSubmits: 0 })).toBe(800);
  });

  it('halves the bonus at half of par time', () => {
    expect(computeScore({ difficulty: 'medium', wordCount: 10, elapsedSeconds: 300, wrongSubmits: 0 })).toBe(1875);
  });

  it('subtracts a penalty per wrong submit and never goes negative', () => {
    const clean = computeScore({ difficulty: 'hard', wordCount: 20, elapsedSeconds: 900, wrongSubmits: 0 });
    const twoWrong = computeScore({ difficulty: 'hard', wordCount: 20, elapsedSeconds: 900, wrongSubmits: 2 });
    expect(clean - twoWrong).toBe(2 * WRONG_SUBMIT_PENALTY);
    expect(computeScore({ difficulty: 'easy', wordCount: 1, elapsedSeconds: 999, wrongSubmits: 100 })).toBe(0);
  });
});
