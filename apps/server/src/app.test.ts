import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  HINT_PENALTY,
  MAX_HINTS,
  computeScore,
  generatePuzzle,
  solutionGrid,
  type GiveUpResponse,
  type HintResponse,
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
  app = buildApp({
    dbPath: ':memory:',
    clues,
    now: () => clock,
    googleClientId: 'test-client',
    // Stand-in for Google: a credential "ok:<id>:<name>" is valid, anything else is not.
    verifyGoogle: async (credential) => {
      const [status, sub, name] = credential.split(':');
      return status === 'ok' ? { sub, name } : null;
    },
  });
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

describe('google sign-in', () => {
  const google = (credential: string, player?: PlayerSession) =>
    app.inject({ method: 'POST', url: '/api/auth/google', headers: player ? auth(player) : {}, payload: { credential } });

  it('tells the client which Google client id to use', async () => {
    expect((await app.inject({ url: '/api/config' })).json()).toEqual({ googleClientId: 'test-client' });
  });

  it('creates an account on first sign-in and returns the same one afterwards', async () => {
    const first = await google('ok:g-1:Ada');
    expect(first.statusCode).toBe(201);
    const created: PlayerSession = first.json();
    expect(created).toMatchObject({ nickname: 'Ada', google: true });

    const again: PlayerSession = (await google('ok:g-1:Renamed')).json();
    expect(again).toEqual(created);
  });

  it('rejects a credential Google does not vouch for', async () => {
    expect((await google('forged:g-1:Ada')).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/auth/google', payload: {} })).statusCode).toBe(400);
  });

  it('upgrades a guest in place, keeping its scores', async () => {
    const guest = await join('Guest');
    expect(guest.google).toBe(false);
    const { puzzleId } = await daily(guest);
    await submit(guest, puzzleId, easySolution());

    const linked: PlayerSession = (await google('ok:g-2:Ada', guest)).json();
    expect(linked).toMatchObject({ id: guest.id, token: guest.token, nickname: 'Guest', google: true });
    expect((await daily(linked)).attempt.score).not.toBeNull();

    // Signing in on another device reaches the same account.
    expect((await google('ok:g-2:Ada')).json().id).toBe(guest.id);
  });

  it('switches to the existing Google account rather than overwriting it', async () => {
    const owner: PlayerSession = (await google('ok:g-3:Owner')).json();
    const guest = await join('Guest');
    const result: PlayerSession = (await google('ok:g-3:Owner', guest)).json();
    expect(result.id).toBe(owner.id);
    const me = await app.inject({ url: '/api/me', headers: auth(guest) });
    expect(me.json()).toMatchObject({ id: guest.id, google: false });
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
  it('rejects a grid of the wrong shape', async () => {
    const player = await join('Ada');
    const { puzzleId } = await daily(player);
    expect((await submit(player, puzzleId, ['ABC'])).statusCode).toBe(400);
  });

  it('scores a fully solved grid with a server-timed bonus', async () => {
    const player = await join('Ada');
    const { puzzleId, puzzle } = await daily(player);
    clock += 150_000;
    const body: SubmitResponse = (await submit(player, puzzleId, easySolution())).json();
    const total = puzzle.entries.length;
    const expected = computeScore({ difficulty: 'easy', correctEntries: total, elapsedSeconds: 150, hintsUsed: 0 });
    expect(body).toMatchObject({ score: expected, elapsedSeconds: 150, correctEntries: total, totalEntries: total, rank: 1 });
    expect(body.review.every((entry) => entry.status === 'correct')).toBe(true);

    // Finished puzzle reopens read-only with the solution, and cannot be submitted again.
    const reopened = await daily(player);
    expect(reopened.solution).toEqual(easySolution());
    expect(reopened.attempt.score).toBe(expected);
    expect(reopened.review).toEqual(body.review);
    expect((await submit(player, puzzleId, easySolution())).statusCode).toBe(409);
  });

  it('can be submitted part-way, scoring only the correct entries', async () => {
    const player = await join('Ada');
    const { puzzleId } = await daily(player);
    const puzzle = generatePuzzle(clues, 'easy', '2026-10-02:easy');
    const first = puzzle.entries[0];
    const grid: string[][] = easySolution().map((row) => [...row].map((char) => (char === '.' ? '.' : ' ')));
    [...first.answer].forEach((letter, i) => {
      if (first.direction === 'across') grid[first.row][first.col + i] = letter;
      else grid[first.row + i][first.col] = letter;
    });

    clock += 300_000; // par time for easy: no time bonus
    const body: SubmitResponse = (await submit(player, puzzleId, grid.map((row) => row.join('')))).json();
    expect(body).toMatchObject({ score: 100, correctEntries: 1, totalEntries: puzzle.entries.length });
    expect(body.review[0].status).toBe('correct');
    expect(body.review.slice(1).every((entry) => entry.status === 'unanswered')).toBe(true);
    expect(body.solution).toEqual(easySolution());
  });

  it('accepts lowercase letters', async () => {
    const player = await join('Ada');
    const { puzzleId, puzzle } = await daily(player);
    const grid = easySolution().map((row) => row.toLowerCase());
    expect((await submit(player, puzzleId, grid)).json().correctEntries).toBe(puzzle.entries.length);
  });
});

describe('hints', () => {
  const hint = (player: PlayerSession, puzzleId: string, row: number, col: number) =>
    app.inject({ method: 'POST', url: `/api/puzzles/${puzzleId}/hint`, headers: auth(player), payload: { row, col } });

  const letterCells = () =>
    easySolution().flatMap((line, row) => [...line].flatMap((char, col) => (char === '.' ? [] : [[row, col, char] as const])));

  it('reveals the letter of a cell and counts down', async () => {
    const player = await join('Ada');
    const { puzzleId } = await daily(player);
    const [row, col, letter] = letterCells()[0];
    const body: HintResponse = (await hint(player, puzzleId, row, col)).json();
    expect(body).toEqual({ row, col, letter, hintsLeft: MAX_HINTS - 1 });

    // Asking again for the same cell is free, and a reload brings the hint back.
    expect((await hint(player, puzzleId, row, col)).json().hintsLeft).toBe(MAX_HINTS - 1);
    const reopened = await daily(player);
    expect(reopened.hints).toEqual([{ row, col, letter }]);
    expect(reopened.attempt.hintsUsed).toBe(1);
  });

  it('refuses blocks, bad cells and a hint beyond the limit', async () => {
    const player = await join('Ada');
    const { puzzleId } = await daily(player);
    const solution = easySolution();
    const blockRow = solution.findIndex((line) => line.includes('.'));
    expect((await hint(player, puzzleId, blockRow, solution[blockRow].indexOf('.'))).statusCode).toBe(400);
    expect((await hint(player, puzzleId, 99, 0)).statusCode).toBe(400);

    const cells = letterCells();
    for (let i = 0; i < MAX_HINTS; i++) expect((await hint(player, puzzleId, cells[i][0], cells[i][1])).statusCode).toBe(200);
    const extra = await hint(player, puzzleId, cells[MAX_HINTS][0], cells[MAX_HINTS][1]);
    expect(extra.statusCode).toBe(409);
  });

  it('charges a penalty per hint and counts revealed letters as filled', async () => {
    const player = await join('Ada');
    const { puzzleId, puzzle } = await daily(player);
    const [row, col] = letterCells()[0];
    await hint(player, puzzleId, row, col);

    // The client sends that cell blank; the server still knows the letter was revealed.
    const grid = easySolution().map((line, r) => (r === row ? line.slice(0, col) + ' ' + line.slice(col + 1) : line));
    clock += 300_000;
    const body: SubmitResponse = (await submit(player, puzzleId, grid)).json();
    const total = puzzle.entries.length;
    expect(body).toMatchObject({ correctEntries: total, hintsUsed: 1, score: 100 * total - HINT_PENALTY });
  });

  it('is refused once the puzzle is finished', async () => {
    const player = await join('Ada');
    const { puzzleId } = await daily(player);
    await submit(player, puzzleId, easySolution());
    const [row, col] = letterCells()[0];
    expect((await hint(player, puzzleId, row, col)).statusCode).toBe(409);
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
    expect(result.rank).toBe(1);
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
    expect(result.rank).toBeNull();
    const board: LeaderboardResponse = (await app.inject({ url: '/api/leaderboard?difficulty=easy' })).json();
    expect(board.rows).toEqual([]);
  });
});
