import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import type { ClueEntry } from '@crossword/shared';
import { loadClueBank } from './clueBank';
import type { AppContext } from './context';
import { Store } from './db';
import { createGoogleVerifier, type GoogleVerifier } from './google';
import { registerLeaderboardRoutes } from './routes/leaderboard';
import { registerPlayerRoutes } from './routes/players';
import { registerPuzzleRoutes } from './routes/puzzles';

export interface AppOptions {
  dbPath: string;
  clues?: ClueEntry[];
  now?: () => number;
  logger?: boolean;
  /** Built web app to serve alongside the API; omitted in development, where Vite serves it. */
  staticDir?: string;
  /** OAuth client id for Google sign-in; without it only guest play is offered. */
  googleClientId?: string;
  /** Replaces the real Google check in tests. */
  verifyGoogle?: GoogleVerifier;
}

export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });
  const ctx: AppContext = {
    store: new Store(options.dbPath),
    clues: options.clues ?? loadClueBank(),
    now: options.now ?? Date.now,
    googleClientId: options.googleClientId ?? null,
    verifyGoogle:
      options.verifyGoogle ?? (options.googleClientId ? createGoogleVerifier(options.googleClientId) : async () => null),
  };
  app.addHook('onClose', async () => ctx.store.close());

  app.get('/api/health', async () => ({ ok: true }));
  registerPlayerRoutes(app, ctx);
  registerPuzzleRoutes(app, ctx);
  registerLeaderboardRoutes(app, ctx);

  if (options.staticDir) app.register(fastifyStatic, { root: options.staticDir });
  return app;
}
