import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  DIFFICULTIES,
  computeScore,
  countWrongEntries,
  generatePuzzle,
  isValidGridShape,
  reviewEntries,
  solutionGrid,
  toPublicPuzzle,
  type DailyStatus,
  type DailyStatusResponse,
  type Difficulty,
  type GiveUpResponse,
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

function puzzleResponse(ctx: AppContext, row: PuzzleRow, attempt: AttemptRow): PuzzleResponse {
  const end = attempt.finished_at ?? ctx.now();
  return {
    puzzleId: row.id,
    kind: row.kind,
    date: row.date,
    puzzle: toPublicPuzzle(row.puzzle),
    attempt: {
      startedAt: attempt.started_at,
      finishedAt: attempt.finished_at,
      elapsedSeconds: Math.floor((end - attempt.started_at) / 1000),
      wrongSubmits: attempt.wrong_submits,
      score: attempt.score,
      gaveUp: attempt.gave_up === 1,
    },
    solution: attempt.finished_at === null ? null : solutionGrid(row.puzzle),
    review: attempt.final_grid === null ? null : reviewEntries(row.puzzle, JSON.parse(attempt.final_grid)),
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

  app.post('/api/puzzles/:id/submit', async (request, reply) => {
    const player = requirePlayer(ctx, request, reply);
    if (!player) return;
    const row = ctx.store.getPuzzle((request.params as { id: string }).id);
    if (!row) return reply.code(404).send({ error: 'Puzzle not found' });
    const attempt = ctx.store.getAttempt(player.id, row.id);
    if (!attempt) return reply.code(409).send({ error: 'Puzzle not started' });
    if (attempt.finished_at !== null) return reply.code(409).send({ error: 'Puzzle already finished' });

    const grid = (request.body as { grid?: unknown } | null)?.grid;
    if (!isValidGridShape(row.puzzle, grid)) return reply.code(400).send({ error: 'Grid has wrong shape' });

    const wrongEntries = countWrongEntries(row.puzzle, grid);
    if (wrongEntries > 0) {
      // No hints: only the count is revealed, never which entries.
      ctx.store.recordWrongSubmit(attempt.id);
      const response: SubmitResponse = { solved: false, wrongEntries, wrongSubmits: attempt.wrong_submits + 1 };
      return response;
    }

    const finishedAt = ctx.now();
    const elapsedMs = finishedAt - attempt.started_at;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const score = computeScore({
      difficulty: row.difficulty,
      wordCount: row.puzzle.entries.length,
      elapsedSeconds,
      wrongSubmits: attempt.wrong_submits,
    });
    ctx.store.finishAttempt(attempt.id, finishedAt, score);
    const response: SubmitResponse = {
      solved: true,
      score,
      elapsedSeconds,
      wrongSubmits: attempt.wrong_submits,
      rank: row.kind === 'daily' ? ctx.store.rank(row.id, score, elapsedMs) : null,
      solution: solutionGrid(row.puzzle),
    };
    return response;
  });

  // Ends the attempt with zero points and reveals every answer alongside what the player had.
  app.post('/api/puzzles/:id/giveup', async (request, reply) => {
    const player = requirePlayer(ctx, request, reply);
    if (!player) return;
    const row = ctx.store.getPuzzle((request.params as { id: string }).id);
    if (!row) return reply.code(404).send({ error: 'Puzzle not found' });
    const attempt = ctx.store.getAttempt(player.id, row.id);
    if (!attempt) return reply.code(409).send({ error: 'Puzzle not started' });
    if (attempt.finished_at !== null) return reply.code(409).send({ error: 'Puzzle already finished' });

    const grid = (request.body as { grid?: unknown } | null)?.grid;
    if (!isValidGridShape(row.puzzle, grid)) return reply.code(400).send({ error: 'Grid has wrong shape' });

    const finishedAt = ctx.now();
    ctx.store.giveUpAttempt(attempt.id, finishedAt, grid);
    const response: GiveUpResponse = {
      solution: solutionGrid(row.puzzle),
      review: reviewEntries(row.puzzle, grid),
      elapsedSeconds: Math.floor((finishedAt - attempt.started_at) / 1000),
    };
    return response;
  });
}
