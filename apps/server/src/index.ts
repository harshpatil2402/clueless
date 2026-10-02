import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app';

const dbPath = process.env.DB_PATH ?? fileURLToPath(new URL('../data/crossword.db', import.meta.url));
mkdirSync(dirname(dbPath), { recursive: true });

// In production the built web app is served from the same origin as the API.
const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));

// A client id is public by design; it only names this app to Google. Override per deployment if needed.
const googleClientId =
  process.env.GOOGLE_CLIENT_ID ?? '821973869510-23ha0hpki34i704594qrvg9gh7l1r663.apps.googleusercontent.com';

const app = buildApp({ dbPath, logger: true, staticDir: existsSync(webDist) ? webDist : undefined, googleClientId });
const port = Number(process.env.PORT ?? 3001);

// Hosting platforms inject PORT and need the server reachable from outside the container;
// local development keeps to loopback.
const host = process.env.HOST ?? (process.env.PORT ? '0.0.0.0' : '127.0.0.1');

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
