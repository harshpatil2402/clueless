import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app';

const dbPath = process.env.DB_PATH ?? fileURLToPath(new URL('../data/crossword.db', import.meta.url));
mkdirSync(dirname(dbPath), { recursive: true });

// In production the built web app is served from the same origin as the API.
const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));

const app = buildApp({ dbPath, logger: true, staticDir: existsSync(webDist) ? webDist : undefined });
const port = Number(process.env.PORT ?? 3001);

app.listen({ port, host: process.env.HOST ?? '127.0.0.1' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
