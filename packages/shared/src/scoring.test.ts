import { describe, expect, it } from 'vitest';
import { computeScore, HINT_PENALTY } from './scoring';

describe('computeScore', () => {
  it('gives full time bonus for an instant solve', () => {
    expect(computeScore({ difficulty: 'easy', correctEntries: 8, elapsedSeconds: 0, hintsUsed: 0 })).toBe(1200);
  });

  it('gives no time bonus at or beyond par time', () => {
    expect(computeScore({ difficulty: 'easy', correctEntries: 8, elapsedSeconds: 300, hintsUsed: 0 })).toBe(800);
    expect(computeScore({ difficulty: 'easy', correctEntries: 8, elapsedSeconds: 9999, hintsUsed: 0 })).toBe(800);
  });

  it('halves the bonus at half of par time', () => {
    expect(computeScore({ difficulty: 'medium', correctEntries: 10, elapsedSeconds: 300, hintsUsed: 0 })).toBe(1875);
  });

  it('scores a partly solved grid by its correct entries', () => {
    expect(computeScore({ difficulty: 'easy', correctEntries: 3, elapsedSeconds: 300, hintsUsed: 0 })).toBe(300);
    expect(computeScore({ difficulty: 'easy', correctEntries: 0, elapsedSeconds: 0, hintsUsed: 0 })).toBe(0);
  });

  it('subtracts a penalty per hint and never goes negative', () => {
    const clean = computeScore({ difficulty: 'hard', correctEntries: 20, elapsedSeconds: 900, hintsUsed: 0 });
    const hinted = computeScore({ difficulty: 'hard', correctEntries: 20, elapsedSeconds: 900, hintsUsed: 2 });
    expect(clean - hinted).toBe(2 * HINT_PENALTY);
    expect(computeScore({ difficulty: 'easy', correctEntries: 0, elapsedSeconds: 999, hintsUsed: 5 })).toBe(0);
  });
});
