import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  BLOCK,
  DIFFICULTIES,
  MAX_HINTS,
  computeScore,
  generatePuzzle,
  isValidGridShape,
  reviewEntries,
  solutionGrid,
  toPublicPuzzle,
  type DailyStatus,
  type DailyStatusResponse,
  type Difficulty,
  type GiveUpResponse,
  type HintResponse,
  type PuzzleResponse,
  type SubmitResponse,
} from '@crossword/shared';
import { dailyPuzzleId, parseDifficulty, requirePlayer, today, type AppContext } from '../context';
import type { AttemptRow, PuzzleRow } from '../db';

function loadOrCreateDaily(ctx: AppContext, date: string, difficulty: Difficulty): PuzzleRow {
  const id = dailyPuzzleId(date, difficulty);
  const existing = ctx.store.getPuzzle(id);
  if (existing) return existing;
  const row: PuzzleRow = {
    id,
    kind: 'daily',
    date,
    difficulty,
    puzzle: generatePuzzle(ctx.clues, difficulty, `${date}:${difficulty}`),
  };
  ctx.store.insertPuzzle(row);
  return row;
}

function hintedCells(attempt: AttemptRow): Array<[number, number]> {
  return attempt.hinted_cells === null ? [] : JSON.parse(attempt.hinted_cells);
}

/** Revealed letters are known to the player, so they count as filled in whatever the client sent. */
function withHints(grid: string[], solution: string[], cells: Array<[number, number]>): string[] {
  const rows = grid.map((row) => [...row]);
  for (const [row, col] of cells) rows[row][col] = solution[row][col];
  return rows.map((row) => row.join(''));
}

function puzzleResponse(ctx: AppContext, row: PuzzleRow, attempt: AttemptRow): PuzzleResponse {
  const end = attempt.finished_at ?? ctx.now();
  const solution = solutionGrid(row.puzzle);
  return {
    puzzleId: row.id,
    kind: row.kind,
    date: row.date,
    puzzle: toPublicPuzzle(row.puzzle),
    attempt: {
      startedAt: attempt.started_at,
      finishedAt: attempt.finished_at,
      elapsedSeconds: Math.floor((end - attempt.started_at) / 1000),
      hintsUsed: attempt.hints_used,
      score: attempt.score,
      gaveUp: attempt.gave_up === 1,
    },
    solution: attempt.finished_at === null ? null : solution,
    review: attempt.final_grid === null ? null : reviewEntries(row.puzzle, JSON.parse(attempt.final_grid)),
    hints: hintedCells(attempt).map(([r, c]) => ({ row: r, col: c, letter: solution[r][c] })),
  };
}

export function registerPuzzleRoutes(app: FastifyInstance, ctx: AppContext): void {
  // Read-only: lets the home screen show progress without starting any timer.
  app.get('/api/puzzles/daily/status', async (request, reply) => {
    const player = requirePlayer(ctx, request, reply);
    if (!player) return;
    const date = today(ctx);
    const status = {} as DailyStatus;
    for (const difficulty of DIFFICULTIES) {
      const attempt = ctx.store.getAttempt(player.id, dailyPuzzleId(date, difficulty));
      status[difficulty] = {
        started: attempt !== undefined,
        finished: attempt?.finished_at != null,
        gaveUp: attempt?.gave_up === 1,
        score: attempt?.score ?? null,
      };
    }
    const response: DailyStatusResponse = { date, status };
    return response;
  });

  // Fetching a puzzle starts the player's timer on first call.
  app.get('/api/puzzles/daily', async (request, reply) => {
    const player = requirePlayer(ctx, request, reply);
    if (!player) return;
    const difficulty = parseDifficulty((request.query as { difficulty?: unknown }).difficulty);
    if (!difficulty) return reply.code(400).send({ error: 'Unknown difficulty' });
    const row = loadOrCreateDaily(ctx, today(ctx), difficulty);
    return puzzleResponse(ctx, row, ctx.store.startAttempt(player.id, row.id, ctx.now()));
  });

  app.post('/api/puzzles/practice', async (request, reply) => {
    const player = requirePlayer(ctx, request, reply);
    if (!player) return;
    const difficulty = parseDifficulty((request.body as { difficulty?: unknown } | null)?.difficulty);
    if (!difficulty) return reply.code(400).send({ error: 'Unknown difficulty' });
    const id = randomUUID();
    const row: PuzzleRow = {
      id,
      kind: 'practice',
      date: null,
      difficulty,
      puzzle: generatePuzzle(ctx.clues, difficulty, id),
    };
    ctx.store.insertPuzzle(row);
    return reply.code(201).send(puzzleResponse(ctx, row, ctx.store.startAttempt(player.id, row.id, ctx.now())));
  });

  app.get('/api/puzzles/:id', async (request, reply) => {
    const player = requirePlayer(ctx, request, reply);
    if (!player) return;
    const row = ctx.store.getPuzzle((request.params as { id: string }).id);
    if (!row) return reply.code(404).send({ error: 'Puzzle not found' });
    return puzzleResponse(ctx, row, ctx.store.startAttempt(player.id, row.id, ctx.now()));
  });

  /** Shared checks for the routes that act on an attempt still in progress. */
  function openAttempt(playerId: string, puzzleId: string): { error: [number, string] } | { row: PuzzleRow; attempt: AttemptRow } {
    const row = ctx.store.getPuzzle(puzzleId);
    if (!row) return { error: [404, 'Puzzle not found'] };
    const attempt = ctx.store.getAttempt(playerId, row.id);
    if (!attempt) return { error: [409, 'Puzzle not started'] };
    if (attempt.finished_at !== null) return { error: [409, 'Puzzle already finished'] };
    return { row, attempt };
  }

  // Reveals one letter. Limited per puzzle; asking again for a revealed cell is free.
  app.post('/api/puzzles/:id/hint', async (request, reply) => {
    const player = requirePlayer(ctx, request, reply);
    if (!player) return;
    const found = openAttempt(player.id, (request.params as { id: string }).id);
    if ('error' in found) return reply.code(found.error[0]).send({ error: found.error[1] });
    const { row, attempt } = found;

    const body = request.body as { row?: unknown; col?: unknown } | null;
    const solution = solutionGrid(row.puzzle);
    const r = body?.row;
    const c = body?.col;
    if (typeof r !== 'number' || typeof c !== 'number' || !Number.isInteger(r) || !Number.isInteger(c)) {
      return reply.code(400).send({ error: 'Cell must be given as row and col' });
    }
    const letter = solution[r]?.[c];
    if (letter === undefined || letter === BLOCK) return reply.code(400).send({ error: 'No letter in that cell' });

    const cells = hintedCells(attempt);
    if (!cells.some(([hr, hc]) => hr === r && hc === c)) {
      if (cells.length >= MAX_HINTS) return reply.code(409).send({ error: 'No hints left' });
      cells.push([r, c]);
      ctx.store.recordHints(attempt.id, cells);
    }
    const response: HintResponse = { row: r, col: c, letter, hintsLeft: MAX_HINTS - cells.length };
    return response;
  });

  // Final at any point: scores the entries that are correct and reveals the rest.
  app.post('/api/puzzles/:id/submit', async (request, reply) => {
    const player = requirePlayer(ctx, request, reply);
    if (!player) return;
    const found = openAttempt(player.id, (request.params as { id: string }).id);
    if ('error' in found) return reply.code(found.error[0]).send({ error: found.error[1] });
    const { row, attempt } = found;

    const grid = (request.body as { grid?: unknown } | null)?.grid;
    if (!isValidGridShape(row.puzzle, grid)) return reply.code(400).send({ error: 'Grid has wrong shape' });

    const solution = solutionGrid(row.puzzle);
    const finalGrid = withHints(grid, solution, hintedCells(attempt));
    const review = reviewEntries(row.puzzle, finalGrid);
    const correctEntries = review.filter((entry) => entry.status === 'correct').length;
    const finishedAt = ctx.now();
    const elapsedMs = finishedAt - attempt.started_at;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const score = computeScore({
      difficulty: row.difficulty,
      correctEntries,
      elapsedSeconds,
      hintsUsed: attempt.hints_used,
    });
    ctx.store.finishAttempt(attempt.id, finishedAt, score, finalGrid);
    const response: SubmitResponse = {
      score,
      elapsedSeconds,
      correctEntries,
      totalEntries: review.length,
      hintsUsed: attempt.hints_used,
      rank: row.kind === 'daily' ? ctx.store.rank(row.id, score, elapsedMs) : null,
      solution,
      review,
    };
    return response;
  });

  // Ends the attempt with zero points and reveals every answer alongside what the player had.
  app.post('/api/puzzles/:id/giveup', async (request, reply) => {
    const player = requirePlayer(ctx, request, reply);
    if (!player) return;
    const found = openAttempt(player.id, (request.params as { id: string }).id);
    if ('error' in found) return reply.code(found.error[0]).send({ error: found.error[1] });
    const { row, attempt } = found;

    const grid = (request.body as { grid?: unknown } | null)?.grid;
    if (!isValidGridShape(row.puzzle, grid)) return reply.code(400).send({ error: 'Grid has wrong shape' });

    const solution = solutionGrid(row.puzzle);
    const finalGrid = withHints(grid, solution, hintedCells(attempt));
    const finishedAt = ctx.now();
    ctx.store.giveUpAttempt(attempt.id, finishedAt, finalGrid);
    const response: GiveUpResponse = {
      solution,
      review: reviewEntries(row.puzzle, finalGrid),
      elapsedSeconds: Math.floor((finishedAt - attempt.started_at) / 1000),
    };
    return response;
  });
}
