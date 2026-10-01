import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  computeScore,
  generatePuzzle,
  solutionGrid,
  type GiveUpResponse,
  type LeaderboardResponse,
  type PlayerSession,
  type PuzzleResponse,
  type SubmitResponse,
} from '@crossword/shared';
import { buildApp } from './app';
import { loadClueBank } from './clueBank';

const clues = loadClueBank();
const START = Date.UTC(2026, 9, 2, 10, 0, 0);

let app: FastifyInstance;
let clock: number;

beforeEach(() => {
  clock = START;
  app = buildApp({ dbPath: ':memory:', clues, now: () => clock });
});

afterEach(async () => {
  await app.close();
});

async function join(nickname: string): Promise<PlayerSession> {
  const response = await app.inject({ method: 'POST', url: '/api/players', payload: { nickname } });
  expect(response.statusCode).toBe(201);
  return response.json();
}

const auth = (player: PlayerSession) => ({ authorization: `Bearer ${player.token}` });

async function daily(player: PlayerSession, difficulty = 'easy'): Promise<PuzzleResponse> {
  const response = await app.inject({ url: `/api/puzzles/daily?difficulty=${difficulty}`, headers: auth(player) });
  expect(response.statusCode).toBe(200);
  return response.json();
}

async function submit(player: PlayerSession, puzzleId: string, grid: string[]) {
  return app.inject({ method: 'POST', url: `/api/puzzles/${puzzleId}/submit`, headers: auth(player), payload: { grid } });
}

const easySolution = () => solutionGrid(generatePuzzle(clues, 'easy', '2026-10-02:easy'));

/** Replaces the first letter of the grid with a letter that is certainly wrong. */
function spoil(grid: string[]): string[] {
  const copy = [...grid];
  const row = copy.findIndex((line) => /[A-Z]/.test(line));
  copy[row] = copy[row].replace(/[A-Z]/, (letter) => (letter === 'X' ? 'Y' : 'X'));
  return copy;
}

describe('players', () => {
  it('rejects empty and oversized nicknames', async () => {
    for (const nickname of ['', '   ', 'x'.repeat(21)]) {
      const response = await app.inject({ method: 'POST', url: '/api/players', payload: { nickname } });
      expect(response.statusCode).toBe(400);
    }
  });

  it('requires a valid token for puzzles', async () => {
    expect((await app.inject({ url: '/api/puzzles/daily?difficulty=easy' })).statusCode).toBe(401);
    const response = await app.inject({
      url: '/api/puzzles/daily?difficulty=easy',
      headers: { authorization: 'Bearer nope' },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe('daily puzzle', () => {
  it('never leaks answers before the puzzle is solved', async () => {
    const player = await join('Ada');
    const response = await app.inject({ url: '/api/puzzles/daily?difficulty=easy', headers: auth(player) });
    const body: PuzzleResponse = response.json();
    expect(body.solution).toBeNull();
    for (const entry of body.puzzle.entries) expect(entry).not.toHaveProperty('answer');
    const answers = generatePuzzle(clues, 'easy', '2026-10-02:easy').entries.map((e) => e.answer);
    for (const answer of answers) expect(response.body).not.toContain(`"${answer}"`);
  });

  it('is the same for every player and keeps the first start time', async () => {
    const ada = await join('Ada');
    const bob = await join('Bob');
    const first = await daily(ada);
    clock += 60_000;
    expect((await daily(bob)).puzzle).toEqual(first.puzzle);
    const again = await daily(ada);
    expect(again.attempt.startedAt).toBe(START);
    expect(again.attempt.elapsedSeconds).toBe(60);
  });

  it('rejects unknown difficulty', async () => {
    const player = await join('Ada');
    const response = await app.inject({ url: '/api/puzzles/daily?difficulty=brutal', headers: auth(player) });
    expect(response.statusCode).toBe(400);
  });

  it('reports status without starting the timer', async () => {
    const player = await join('Ada');
    const status = await app.inject({ url: '/api/puzzles/daily/status', headers: auth(player) });
    expect(status.json().status.easy).toEqual({ started: false, finished: false, gaveUp: false, score: null });
    clock += 30_000;
    expect((await daily(player)).attempt.startedAt).toBe(START + 30_000);
  });
});

describe('submit', () => {
  it('counts wrong entries without saying which, and penalises', async () => {
    const player = await join('Ada');
    const { puzzleId } = await daily(player);
    const response = await submit(player, puzzleId, spoil(easySolution()));
    const body: SubmitResponse = response.json();
    expect(body.solved).toBe(false);
    expect(body).toMatchObject({ wrongSubmits: 1 });
    expect(Object.keys(body).sort()).toEqual(['solved', 'wrongEntries', 'wrongSubmits']);
  });

  it('rejects a grid of the wrong shape', async () => {
    const player = await join('Ada');
    const { puzzleId } = await daily(player);
    expect((await submit(player, puzzleId, ['ABC'])).statusCode).toBe(400);
  });

  it('finishes the attempt with a server-timed score', async () => {
    const player = await join('Ada');
    const { puzzleId, puzzle } = await daily(player);
    await submit(player, puzzleId, spoil(easySolution()));
    clock += 150_000;
    const body: SubmitResponse = (await submit(player, puzzleId, easySolution())).json();
    const expected = computeScore({
      difficulty: 'easy',
      wordCount: puzzle.entries.length,
      elapsedSeconds: 150,
      wrongSubmits: 1,
    });
    expect(body).toMatchObject({ solved: true, score: expected, elapsedSeconds: 150, wrongSubmits: 1, rank: 1 });

    // Solved puzzle reopens read-only with the solution, and cannot be submitted again.
    const reopened = await daily(player);
    expect(reopened.solution).toEqual(easySolution());
    expect(reopened.attempt.score).toBe(expected);
    expect((await submit(player, puzzleId, easySolution())).statusCode).toBe(409);
  });

  it('accepts lowercase letters', async () => {
    const player = await join('Ada');
    const { puzzleId } = await daily(player);
    const grid = easySolution().map((row) => row.toLowerCase());
    expect((await submit(player, puzzleId, grid)).json().solved).toBe(true);
  });
});

describe('give up', () => {
  const giveUp = (player: PlayerSession, puzzleId: string, grid: string[]) =>
    app.inject({ method: 'POST', url: `/api/puzzles/${puzzleId}/giveup`, headers: auth(player), payload: { grid } });

  it('reveals answers and sorts entries into correct, wrong and unanswered', async () => {
    const player = await join('Ada');
    const { puzzleId } = await daily(player);
    const puzzle = generatePuzzle(clues, 'easy', '2026-10-02:easy');

    // First entry solved, second entry's free cells left blank, everything else filled with a wrong letter.
    const [first, second] = puzzle.entries;
    const cellsOf = (entry: typeof first) =>
      [...entry.answer].map((_, i) => (entry.direction === 'across' ? [entry.row, entry.col + i] : [entry.row + i, entry.col]));
    const grid: string[][] = easySolution().map((row) => [...row].map((char) => (char === '.' ? '.' : 'Q')));
    for (const [row, col] of cellsOf(second)) grid[row][col] = ' ';
    cellsOf(first).forEach(([row, col], i) => (grid[row][col] = first.answer[i]));
    const rows = grid.map((row) => row.join(''));

    clock += 45_000;
    const response = await giveUp(player, puzzleId, rows);
    expect(response.statusCode).toBe(200);
    const body: GiveUpResponse = response.json();
    expect(body.solution).toEqual(easySolution());
    expect(body.elapsedSeconds).toBe(45);
    expect(body.review).toHaveLength(puzzle.entries.length);
    expect(body.review[0]).toMatchObject({ answer: first.answer, given: first.answer, status: 'correct' });
    expect(body.review[1]).toMatchObject({ answer: second.answer, status: 'unanswered' });
    expect(body.review.slice(2).every((entry) => entry.status !== 'correct')).toBe(true);
    expect(body.review.some((entry) => entry.status === 'wrong')).toBe(true);

    // Reopening shows the same review; the attempt is closed with no score and no leaderboard row.
    const reopened = await daily(player);
    expect(reopened.attempt).toMatchObject({ gaveUp: true, score: 0, elapsedSeconds: 45 });
    expect(reopened.review).toEqual(body.review);
    expect(reopened.solution).toEqual(easySolution());
    expect((await submit(player, puzzleId, easySolution())).statusCode).toBe(409);
    expect((await giveUp(player, puzzleId, rows)).statusCode).toBe(409);
    const board: LeaderboardResponse = (await app.inject({ url: '/api/leaderboard?difficulty=easy' })).json();
    expect(board.rows).toEqual([]);
  });

  it('does not let a quitter outrank a solver', async () => {
    const quitter = await join('Quit');
    const solver = await join('Solve');
    const { puzzleId } = await daily(quitter);
    await daily(solver);
    await giveUp(quitter, puzzleId, easySolution().map((row) => row.replace(/[A-Z]/g, ' ')));
    clock += 9_999_000;
    const result: SubmitResponse = (await submit(solver, puzzleId, easySolution())).json();
    expect(result).toMatchObject({ solved: true, rank: 1 });
  });
});

describe('leaderboard', () => {
  it('ranks by score, then by time', async () => {
    const slow = await join('Slow');
    const fast = await join('Fast');
    const { puzzleId } = await daily(slow);
    await daily(fast);
    clock += 20_000;
    await submit(fast, puzzleId, easySolution());
    clock += 100_000;
    await submit(slow, puzzleId, easySolution());

    const response = await app.inject({ url: '/api/leaderboard?difficulty=easy', headers: auth(slow) });
    const body: LeaderboardResponse = response.json();
    expect(body.date).toBe('2026-10-02');
    expect(body.rows.map((row) => [row.rank, row.nickname, row.you])).toEqual([
      [1, 'Fast', false],
      [2, 'Slow', true],
    ]);
  });

  it('keeps practice puzzles off the leaderboard', async () => {
    const player = await join('Ada');
    const created = await app.inject({
      method: 'POST',
      url: '/api/puzzles/practice',
      headers: auth(player),
      payload: { difficulty: 'easy' },
    });
    expect(created.statusCode).toBe(201);
    const practice: PuzzleResponse = created.json();
    const grid = solutionGrid(generatePuzzle(clues, 'easy', practice.puzzleId));
    const result: SubmitResponse = (await submit(player, practice.puzzleId, grid)).json();
    expect(result).toMatchObject({ solved: true, rank: null });
    const board: LeaderboardResponse = (await app.inject({ url: '/api/leaderboard?difficulty=easy' })).json();
    expect(board.rows).toEqual([]);
  });
});
