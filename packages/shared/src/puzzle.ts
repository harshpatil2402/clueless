import type { Direction, EntryReview, PublicPuzzle, Puzzle } from './types';

export const BLOCK = '.';
export const EMPTY = ' ';

export function entryCells(entry: { row: number; col: number; direction: Direction }, length: number): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let i = 0; i < length; i++) {
    cells.push(entry.direction === 'across' ? [entry.row, entry.col + i] : [entry.row + i, entry.col]);
  }
  return cells;
}

export function toPublicPuzzle(puzzle: Puzzle): PublicPuzzle {
  return {
    rows: puzzle.rows,
    cols: puzzle.cols,
    difficulty: puzzle.difficulty,
    entries: puzzle.entries.map(({ answer, ...rest }) => ({ ...rest, length: answer.length })),
  };
}

/** Solved grid as one string per row, BLOCK for cells outside every entry. */
export function solutionGrid(puzzle: Puzzle): string[] {
  const grid = Array.from({ length: puzzle.rows }, () => Array<string>(puzzle.cols).fill(BLOCK));
  for (const entry of puzzle.entries) {
    entryCells(entry, entry.answer.length).forEach(([row, col], i) => {
      grid[row][col] = entry.answer[i];
    });
  }
  return grid.map((row) => row.join(''));
}

export function isValidGridShape(puzzle: { rows: number; cols: number }, grid: unknown): grid is string[] {
  return (
    Array.isArray(grid) &&
    grid.length === puzzle.rows &&
    grid.every((row) => typeof row === 'string' && row.length === puzzle.cols)
  );
}

/** Number of entries whose letters do not all match the answer. */
export function countWrongEntries(puzzle: Puzzle, grid: string[]): number {
  let wrong = 0;
  for (const entry of puzzle.entries) {
    const cells = entryCells(entry, entry.answer.length);
    if (cells.some(([row, col], i) => grid[row][col].toUpperCase() !== entry.answer[i])) wrong++;
  }
  return wrong;
}

/** Compares the player's grid with the answers, entry by entry. */
export function reviewEntries(puzzle: Puzzle, grid: string[]): EntryReview[] {
  return puzzle.entries.map((entry) => {
    const given = entryCells(entry, entry.answer.length)
      .map(([row, col]) => grid[row][col].toUpperCase())
      .map((char) => (/[A-Z]/.test(char) ? char : EMPTY))
      .join('');
    const status = given === entry.answer ? 'correct' : given.includes(EMPTY) ? 'unanswered' : 'wrong';
    return { number: entry.number, direction: entry.direction, answer: entry.answer, given, status };
  });
}
