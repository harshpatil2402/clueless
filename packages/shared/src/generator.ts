import { DIFFICULTY_CONFIG } from './difficulty';
import { createRng, shuffle, type Rng } from './rng';
import type { Category, ClueEntry, Difficulty, Direction, PlacedEntry, Puzzle } from './types';

const ATTEMPTS = 30;
/** How many placeable candidates to compare before committing to one. */
const CANDIDATE_WINDOW = 8;

interface Slot {
  entry: ClueEntry;
  row: number;
  col: number;
  direction: Direction;
}

interface Fit {
  row: number;
  col: number;
  direction: Direction;
  crossings: number;
  area: number;
}

// Coordinates stay well inside ±64 of the first word, so this packs them without collisions.
const OFFSET = 64;
const SPAN = 256;
const key = (row: number, col: number) => (row + OFFSET) * SPAN + (col + OFFSET);

class Board {
  private letters = new Map<number, string>();
  private across = new Set<number>();
  private down = new Set<number>();
  private byLetter = new Map<string, Array<[number, number]>>();
  slots: Slot[] = [];
  crossings = 0;
  minRow = 0;
  maxRow = 0;
  minCol = 0;
  maxCol = 0;

  constructor(private maxSize: number) {}

  get area(): number {
    return (this.maxRow - this.minRow + 1) * (this.maxCol - this.minCol + 1);
  }

  /** Checks crossword legality of a placement; null if illegal. */
  fit(word: string, row: number, col: number, direction: Direction): Fit | null {
    const dr = direction === 'down' ? 1 : 0;
    const dc = 1 - dr;
    const endRow = row + dr * (word.length - 1);
    const endCol = col + dc * (word.length - 1);

    let minRow = row, maxRow = endRow, minCol = col, maxCol = endCol;
    if (this.slots.length > 0) {
      minRow = Math.min(minRow, this.minRow);
      maxRow = Math.max(maxRow, this.maxRow);
      minCol = Math.min(minCol, this.minCol);
      maxCol = Math.max(maxCol, this.maxCol);
    }
    const height = maxRow - minRow + 1;
    const width = maxCol - minCol + 1;
    if (height > this.maxSize || width > this.maxSize) return null;

    // Word must not run into another word at either end.
    if (this.letters.has(key(row - dr, col - dc)) || this.letters.has(key(endRow + dr, endCol + dc))) return null;

    const sameDirection = direction === 'across' ? this.across : this.down;
    let crossings = 0;
    for (let i = 0; i < word.length; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      const existing = this.letters.get(key(r, c));
      if (existing !== undefined) {
        if (existing !== word[i] || sameDirection.has(key(r, c))) return null;
        crossings++;
      } else if (this.letters.has(key(r + dc, c + dr)) || this.letters.has(key(r - dc, c - dr))) {
        // A new letter may not touch a parallel word sideways.
        return null;
      }
    }
    if (this.slots.length > 0 && crossings === 0) return null;
    return { row, col, direction, crossings, area: height * width };
  }

  bestFit(word: string, rng: Rng): Fit | null {
    let best: Fit | null = null;
    for (let i = 0; i < word.length; i++) {
      for (const [r, c] of this.byLetter.get(word[i]) ?? []) {
        const cell = key(r, c);
        const usedAcross = this.across.has(cell);
        if (usedAcross && this.down.has(cell)) continue;
        const direction: Direction = usedAcross ? 'down' : 'across';
        const fit =
          direction === 'across' ? this.fit(word, r, c - i, direction) : this.fit(word, r - i, c, direction);
        if (fit && (best === null || compareFits(fit, best, rng) < 0)) best = fit;
      }
    }
    return best;
  }

  place(entry: ClueEntry, fit: Fit): void {
    const { row, col, direction } = fit;
    const dr = direction === 'down' ? 1 : 0;
    const dc = 1 - dr;
    const used = direction === 'across' ? this.across : this.down;
    for (let i = 0; i < entry.answer.length; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      const cell = key(r, c);
      if (!this.letters.has(cell)) {
        this.letters.set(cell, entry.answer[i]);
        const list = this.byLetter.get(entry.answer[i]);
        if (list) list.push([r, c]);
        else this.byLetter.set(entry.answer[i], [[r, c]]);
      }
      used.add(cell);
    }
    const endRow = row + dr * (entry.answer.length - 1);
    const endCol = col + dc * (entry.answer.length - 1);
    if (this.slots.length === 0) {
      this.minRow = row;
      this.maxRow = endRow;
      this.minCol = col;
      this.maxCol = endCol;
    } else {
      this.minRow = Math.min(this.minRow, row);
      this.maxRow = Math.max(this.maxRow, endRow);
      this.minCol = Math.min(this.minCol, col);
      this.maxCol = Math.max(this.maxCol, endCol);
    }
    this.crossings += fit.crossings;
    this.slots.push({ entry, row, col, direction });
  }
}

/** Negative when a is the better fit: more crossings, then smaller grid, then coin flip. */
function compareFits(a: Fit, b: Fit, rng: Rng): number {
  if (a.crossings !== b.crossings) return b.crossings - a.crossings;
  if (a.area !== b.area) return a.area - b.area;
  return rng() < 0.5 ? -1 : 1;
}

function buildLayout(pool: ClueEntry[], maxSize: number, targetWords: number, rng: Rng): Board {
  const board = new Board(maxSize);
  let remaining = shuffle(pool, rng);
  if (remaining.length === 0) return board;

  // Open with the longest of the first few shuffled words, for a good spine.
  const first = remaining.slice(0, 10).reduce((a, b) => (b.answer.length > a.answer.length ? b : a));
  const firstDirection: Direction = rng() < 0.5 ? 'across' : 'down';
  board.place(first, board.fit(first.answer, 0, 0, firstDirection)!);
  remaining = remaining.filter((entry) => entry !== first);

  const categoryCount = new Map<Category, number>([[first.category, 1]]);
  while (board.slots.length < targetWords) {
    // Least-used categories go first so every grid mixes fields. Sort is stable over the shuffle.
    const ordered = [...remaining].sort(
      (a, b) => (categoryCount.get(a.category) ?? 0) - (categoryCount.get(b.category) ?? 0),
    );
    let chosen: { entry: ClueEntry; fit: Fit } | null = null;
    let seen = 0;
    for (const entry of ordered) {
      const fit = board.bestFit(entry.answer, rng);
      if (!fit) continue;
      if (chosen === null || compareFits(fit, chosen.fit, rng) < 0) chosen = { entry, fit };
      if (++seen >= CANDIDATE_WINDOW) break;
    }
    if (chosen === null) break;
    board.place(chosen.entry, chosen.fit);
    categoryCount.set(chosen.entry.category, (categoryCount.get(chosen.entry.category) ?? 0) + 1);
    const placed = chosen.entry;
    remaining = remaining.filter((entry) => entry !== placed);
  }
  return board;
}

function layoutQuality(board: Board, minCategories: number): number {
  const categories = new Set(board.slots.map((slot) => slot.entry.category));
  const acrossCategories = new Set(board.slots.filter((s) => s.direction === 'across').map((s) => s.entry.category));
  const segregated = board.slots
    .filter((s) => s.direction === 'down')
    .every((s) => !acrossCategories.has(s.entry.category));
  let quality = board.slots.length * 1000 + board.crossings * 10 - board.area;
  if (categories.size < minCategories) quality -= 100_000;
  if (segregated) quality -= 50_000;
  return quality;
}

function toPuzzle(board: Board, difficulty: Difficulty, seed: string): Puzzle {
  const slots = board.slots.map((slot) => ({
    ...slot,
    row: slot.row - board.minRow,
    col: slot.col - board.minCol,
  }));

  // Standard numbering: reading order of start cells, shared by across and down.
  const starts = [...new Set(slots.map((slot) => key(slot.row, slot.col)))]
    .map((cell) => [Math.floor(cell / SPAN) - OFFSET, (cell % SPAN) - OFFSET] as [number, number])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const numberOf = new Map(starts.map(([row, col], i) => [key(row, col), i + 1]));

  const entries: PlacedEntry[] = slots
    .map((slot) => ({
      clueId: slot.entry.id,
      number: numberOf.get(key(slot.row, slot.col))!,
      direction: slot.direction,
      row: slot.row,
      col: slot.col,
      answer: slot.entry.answer,
      clue: slot.entry.clue,
      category: slot.entry.category,
    }))
    .sort((a, b) => a.number - b.number || (a.direction === 'across' ? -1 : 1));

  return {
    rows: board.maxRow - board.minRow + 1,
    cols: board.maxCol - board.minCol + 1,
    difficulty,
    seed,
    entries,
  };
}

/** Deterministic: same clue bank, difficulty and seed always give the same puzzle. */
export function generatePuzzle(clues: readonly ClueEntry[], difficulty: Difficulty, seed: string): Puzzle {
  const config = DIFFICULTY_CONFIG[difficulty];
  const pool = clues.filter(
    (clue) => config.clueLevels.includes(clue.difficulty) && clue.answer.length <= config.maxSize,
  );

  let best: Board | null = null;
  let bestQuality = -Infinity;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const board = buildLayout(pool, config.maxSize, config.targetWords, createRng(`${seed}#${attempt}`));
    const quality = layoutQuality(board, config.minCategories);
    if (quality > bestQuality) {
      best = board;
      bestQuality = quality;
    }
  }
  if (best === null || best.slots.length < config.minWords) {
    throw new Error(`Could not build a ${difficulty} puzzle from ${pool.length} clues`);
  }
  return toPuzzle(best, difficulty, seed);
}
