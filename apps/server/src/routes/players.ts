import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Player, PlayerSession } from '@crossword/shared';
import { requirePlayer, type AppContext } from '../context';

const MAX_NICKNAME_LENGTH = 20;

export function registerPlayerRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post('/api/players', async (request, reply) => {
    const body = request.body as { nickname?: unknown } | null;
    const nickname = typeof body?.nickname === 'string' ? body.nickname.trim() : '';
    if (nickname.length === 0 || nickname.length > MAX_NICKNAME_LENGTH) {
      return reply.code(400).send({ error: `Nickname must be 1-${MAX_NICKNAME_LENGTH} characters` });
    }
    const session: PlayerSession = { id: randomUUID(), nickname, token: randomBytes(24).toString('hex') };
    ctx.store.createPlayer(session, ctx.now());
    return reply.code(201).send(session);
  });

  app.get('/api/me', async (request, reply) => {
    const player = requirePlayer(ctx, request, reply);
    if (!player) return;
    const view: Player = { id: player.id, nickname: player.nickname };
    return view;
  });
}
