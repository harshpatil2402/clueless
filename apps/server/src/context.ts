import type { FastifyReply, FastifyRequest } from 'fastify';
import { DIFFICULTIES, type ClueEntry, type Difficulty } from '@crossword/shared';
import type { PlayerRow, Store } from './db';

export interface AppContext {
  store: Store;
  clues: ClueEntry[];
  now: () => number;
}

export function playerFromRequest(ctx: AppContext, request: FastifyRequest): PlayerRow | undefined {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  return ctx.store.playerByToken(header.slice('Bearer '.length));
}

/** Sends 401 and returns undefined when the request carries no valid player token. */
export function requirePlayer(ctx: AppContext, request: FastifyRequest, reply: FastifyReply): PlayerRow | undefined {
  const player = playerFromRequest(ctx, request);
  if (!player) reply.code(401).send({ error: 'Unknown player' });
  return player;
}

export function parseDifficulty(value: unknown): Difficulty | undefined {
  return DIFFICULTIES.find((difficulty) => difficulty === value);
}

/** Daily puzzles roll over at midnight UTC. */
export function today(ctx: AppContext): string {
  return new Date(ctx.now()).toISOString().slice(0, 10);
}

export function dailyPuzzleId(date: string, difficulty: Difficulty): string {
  return `daily-${date}-${difficulty}`;
}
