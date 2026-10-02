export const CATEGORIES = [
  'history',
  'geography',
  'biology',
  'maths',
  'physics',
  'chemistry',
  'english',
  'art',
  'music',
  'astronomy',
  'sports',
  'movies',
  'series',
  'books',
  'gk',
  'currentaffairs',
  'puns',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export type Direction = 'across' | 'down';
export type ClueLevel = 1 | 2 | 3;

export interface ClueEntry {
  id: string;
  answer: string;
  clue: string;
  category: Category;
  difficulty: ClueLevel;
}

export interface PlacedEntry {
  clueId: string;
  number: number;
  direction: Direction;
  row: number;
  col: number;
  answer: string;
  clue: string;
  category: Category;
}

export interface Puzzle {
  rows: number;
  cols: number;
  difficulty: Difficulty;
  seed: string;
  entries: PlacedEntry[];
}

/** What the client is allowed to see: no answers, only their lengths. */
export type PublicEntry = Omit<PlacedEntry, 'answer'> & { length: number };

export interface PublicPuzzle {
  rows: number;
  cols: number;
  difficulty: Difficulty;
  entries: PublicEntry[];
}

// API payloads shared by server and clients

export interface Player {
  id: string;
  nickname: string;
}

export interface PlayerSession extends Player {
  token: string;
}

export interface AttemptView {
  startedAt: number;
  finishedAt: number | null;
  elapsedSeconds: number;
  hintsUsed: number;
  score: number | null;
  gaveUp: boolean;
}

/** A letter the player chose to reveal. */
export interface Hint {
  row: number;
  col: number;
  letter: string;
}

export interface HintResponse extends Hint {
  hintsLeft: number;
}

export type EntryStatus = 'correct' | 'wrong' | 'unanswered';

/** One entry's outcome after giving up: what the player had against the real answer. */
export interface EntryReview {
  number: number;
  direction: Direction;
  answer: string;
  /** Player's letters, with a space for every cell left empty. */
  given: string;
  status: EntryStatus;
}

export interface PuzzleResponse {
  puzzleId: string;
  kind: 'daily' | 'practice';
  date: string | null;
  puzzle: PublicPuzzle;
  attempt: AttemptView;
  /** Filled grid rows, only present once the attempt is finished. */
  solution: string[] | null;
  /** Per-entry outcome, present once the attempt is finished (submitted or given up). */
  review: EntryReview[] | null;
  /** Letters revealed so far, so a reload can restore and lock them. */
  hints: Hint[];
}

export interface GiveUpResponse {
  solution: string[];
  review: EntryReview[];
  elapsedSeconds: number;
}

/** Submitting is final and may happen at any point: the score counts whatever is correct. */
export interface SubmitResponse {
  score: number;
  elapsedSeconds: number;
  correctEntries: number;
  totalEntries: number;
  hintsUsed: number;
  rank: number | null;
  solution: string[];
  review: EntryReview[];
}

export interface LeaderboardRow {
  rank: number;
  nickname: string;
  score: number;
  elapsedSeconds: number;
  you: boolean;
}

export interface LeaderboardResponse {
  date: string;
  difficulty: Difficulty;
  rows: LeaderboardRow[];
}

export type DailyStatus = Record<Difficulty, { started: boolean; finished: boolean; gaveUp: boolean; score: number | null }>;

export interface DailyStatusResponse {
  date: string;
  status: DailyStatus;
}
