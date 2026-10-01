import { describe, expect, it } from 'vitest';
import {
  DIFFICULTIES,
  CATEGORIES,
  DIFFICULTY_CONFIG,
  entryCells,
  generatePuzzle,
  solutionGrid,
  BLOCK,
  type Puzzle,
} from '@crossword/shared';
import { loadClueBank } from './clueBank';

const clues = loadClueBank();
const SEEDS = 100;

/** Every maximal run of 2+ letters in the grid, as "direction:row:col:word". */
function runsInGrid(grid: string[]): string[] {
  const runs: string[] = [];
  const rows = grid.length;
  const cols = grid[0].length;
  const scan = (direction: 'across' | 'down') => {
    const outer = direction === 'across' ? rows : cols;
    const inner = direction === 'across' ? cols : rows;
    for (let a = 0; a < outer; a++) {
      let word = '';
      for (let b = 0; b <= inner; b++) {
        const char = b < inner ? (direction === 'across' ? grid[a][b] : grid[b][a]) : BLOCK;
        if (char !== BLOCK) {
          word += char;
          continue;
        }
        if (word.length >= 2) {
          const start = b - word.length;
          runs.push(direction === 'across' ? `across:${a}:${start}:${word}` : `down:${start}:${a}:${word}`);
        }
        word = '';
      }
    }
  };
  scan('across');
  scan('down');
  return runs.sort();
}

function assertValid(puzzle: Puzzle): void {
  const config = DIFFICULTY_CONFIG[puzzle.difficulty];
  expect(puzzle.rows).toBeLessThanOrEqual(config.maxSize);
  expect(puzzle.cols).toBeLessThanOrEqual(config.maxSize);
  expect(puzzle.entries.length).toBeGreaterThanOrEqual(config.minWords);
  expect(puzzle.entries.length).toBeLessThanOrEqual(config.targetWords);

  // Crossing cells agree on their letter.
  const letters = new Map<string, string>();
  for (const entry of puzzle.entries) {
    entryCells(entry, entry.answer.length).forEach(([row, col], i) => {
      const cell = `${row},${col}`;
      expect(letters.get(cell) ?? entry.answer[i]).toBe(entry.answer[i]);
      letters.set(cell, entry.answer[i]);
    });
  }

  // The words readable in the grid are exactly the entries: no accidental adjacency.
  const expected = puzzle.entries.map((e) => `${e.direction}:${e.row}:${e.col}:${e.answer}`).sort();
  expect(runsInGrid(solutionGrid(puzzle))).toEqual(expected);

  // One connected component.
  const cells = [...letters.keys()];
  const reached = new Set([cells[0]]);
  const queue = [cells[0]];
  while (queue.length > 0) {
    const [row, col] = queue.pop()!.split(',').map(Number);
    for (const next of [`${row + 1},${col}`, `${row - 1},${col}`, `${row},${col + 1}`, `${row},${col - 1}`]) {
      if (letters.has(next) && !reached.has(next)) {
        reached.add(next);
        queue.push(next);
      }
    }
  }
  expect(reached.size).toBe(cells.length);

  // Mixed fields, no repeated answers, clue levels match difficulty.
  expect(new Set(puzzle.entries.map((e) => e.category)).size).toBeGreaterThanOrEqual(config.minCategories);
  expect(new Set(puzzle.entries.map((e) => e.answer)).size).toBe(puzzle.entries.length);
  const byId = new Map(clues.map((clue) => [clue.id, clue]));
  for (const entry of puzzle.entries) {
    expect(config.clueLevels).toContain(byId.get(entry.clueId)!.difficulty);
  }

  // Numbering follows reading order and is shared by entries starting on the same cell.
  const starts = [...new Set(puzzle.entries.map((e) => e.row * 100 + e.col))].sort((a, b) => a - b);
  for (const entry of puzzle.entries) {
    expect(entry.number).toBe(starts.indexOf(entry.row * 100 + entry.col) + 1);
  }
}

describe('clue bank', () => {
  it('has enough clues at every level of every field', () => {
    for (const category of CATEGORIES) {
      for (const level of [1, 2, 3]) {
        const count = clues.filter((clue) => clue.category === category && clue.difficulty === level).length;
        expect(count, `${category} level ${level}`).toBeGreaterThanOrEqual(8);
      }
    }
  });
});

describe('generatePuzzle', () => {
  it('is deterministic for a given seed', () => {
    expect(generatePuzzle(clues, 'medium', '2026-10-02:medium')).toEqual(
      generatePuzzle(clues, 'medium', '2026-10-02:medium'),
    );
  });

  it('gives different puzzles for different seeds', () => {
    const a = generatePuzzle(clues, 'easy', 'a').entries.map((e) => e.answer);
    const b = generatePuzzle(clues, 'easy', 'b').entries.map((e) => e.answer);
    expect(a).not.toEqual(b);
  });

  for (const difficulty of DIFFICULTIES) {
    it(`builds a valid ${difficulty} crossword for ${SEEDS} seeds`, () => {
      for (let i = 0; i < SEEDS; i++) assertValid(generatePuzzle(clues, difficulty, `seed-${i}`));
    }, 60_000);
  }
});
