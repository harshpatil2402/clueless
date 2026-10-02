import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ConfigResponse, Player, PlayerSession } from '@crossword/shared';
import { playerFromRequest, requirePlayer, type AppContext } from '../context';
import type { PlayerRow } from '../db';

const MAX_NICKNAME_LENGTH = 20;

const toSession = (row: PlayerRow): PlayerSession => ({
  id: row.id,
  nickname: row.nickname,
  token: row.token,
  google: row.google_id !== null,
});

export function registerPlayerRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/api/config', async () => {
    const response: ConfigResponse = { googleClientId: ctx.googleClientId };
    return response;
  });

  // Guest account: lives only as a token in the browser that created it.
  app.post('/api/players', async (request, reply) => {
    const body = request.body as { nickname?: unknown } | null;
    const nickname = typeof body?.nickname === 'string' ? body.nickname.trim() : '';
    if (nickname.length === 0 || nickname.length > MAX_NICKNAME_LENGTH) {
      return reply.code(400).send({ error: `Nickname must be 1-${MAX_NICKNAME_LENGTH} characters` });
    }
    const row: PlayerRow = { id: randomUUID(), nickname, token: randomBytes(24).toString('hex'), google_id: null };
    ctx.store.createPlayer(row, ctx.now());
    return reply.code(201).send(toSession(row));
  });

  // Google sign-in. Three outcomes: return the account already tied to this Google id; upgrade the
  // calling guest in place (keeping its scores); or create a fresh account.
  app.post('/api/auth/google', async (request, reply) => {
    const credential = (request.body as { credential?: unknown } | null)?.credential;
    const profile = typeof credential === 'string' ? await ctx.verifyGoogle(credential) : null;
    if (!profile) return reply.code(400).send({ error: 'Google sign-in could not be verified' });

    const existing = ctx.store.playerByGoogleId(profile.sub);
    if (existing) return toSession(existing);

    const guest = playerFromRequest(ctx, request);
    if (guest && guest.google_id === null) {
      ctx.store.linkGoogle(guest.id, profile.sub);
      return toSession({ ...guest, google_id: profile.sub });
    }

    const row: PlayerRow = {
      id: randomUUID(),
      nickname: profile.name.trim().slice(0, MAX_NICKNAME_LENGTH) || 'Player',
      token: randomBytes(24).toString('hex'),
      google_id: profile.sub,
    };
    ctx.store.createPlayer(row, ctx.now());
    return reply.code(201).send(toSession(row));
  });

  app.get('/api/me', async (request, reply) => {
    const player = requirePlayer(ctx, request, reply);
    if (!player) return;
    const view: Player = { id: player.id, nickname: player.nickname, google: player.google_id !== null };
    return view;
  });
}
