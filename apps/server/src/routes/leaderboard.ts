import type { FastifyInstance } from 'fastify';
import type { LeaderboardResponse } from '@crossword/shared';
import { dailyPuzzleId, parseDifficulty, playerFromRequest, today, type AppContext } from '../context';

const LIMIT = 50;

export function registerLeaderboardRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/api/leaderboard', async (request, reply) => {
    const query = request.query as { date?: unknown; difficulty?: unknown };
    const difficulty = parseDifficulty(query.difficulty);
    if (!difficulty) return reply.code(400).send({ error: 'Unknown difficulty' });
    const date = typeof query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : today(ctx);

    const me = playerFromRequest(ctx, request);
    const response: LeaderboardResponse = {
      date,
      difficulty,
      rows: ctx.store.leaderboard(dailyPuzzleId(date, difficulty), LIMIT).map((entry, i) => ({
        rank: i + 1,
        nickname: entry.nickname,
        score: entry.score,
        elapsedSeconds: Math.floor(entry.elapsed_ms / 1000),
        you: entry.player_id === me?.id,
      })),
    };
    return response;
  });
}
