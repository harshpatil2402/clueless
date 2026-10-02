import { DatabaseSync } from 'node:sqlite';
import type { Difficulty, Puzzle } from '@crossword/shared';

export interface PlayerRow {
  id: string;
  nickname: string;
  token: string;
  /** Set once the player has signed in with Google; null for guests. */
  google_id: string | null;
}

export interface PuzzleRow {
  id: string;
  kind: 'daily' | 'practice';
  date: string | null;
  difficulty: Difficulty;
  puzzle: Puzzle;
}

export interface AttemptRow {
  id: number;
  player_id: string;
  puzzle_id: string;
  started_at: number;
  finished_at: number | null;
  wrong_submits: number;
  score: number | null;
  gave_up: number;
  /** JSON rows of the grid as it stood when the player submitted or gave up. */
  final_grid: string | null;
  hints_used: number;
  /** JSON list of [row, col] cells revealed as hints. */
  hinted_cells: string | null;
}

export interface LeaderboardEntry {
  player_id: string;
  nickname: string;
  score: number;
  elapsed_ms: number;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    google_id TEXT
  );
  CREATE TABLE IF NOT EXISTS puzzles (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    date TEXT,
    difficulty TEXT NOT NULL,
    seed TEXT NOT NULL,
    data_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL REFERENCES players(id),
    puzzle_id TEXT NOT NULL REFERENCES puzzles(id),
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    wrong_submits INTEGER NOT NULL DEFAULT 0,
    score INTEGER,
    gave_up INTEGER NOT NULL DEFAULT 0,
    final_grid TEXT,
    hints_used INTEGER NOT NULL DEFAULT 0,
    hinted_cells TEXT,
    UNIQUE (player_id, puzzle_id)
  );
  CREATE INDEX IF NOT EXISTS attempts_by_puzzle ON attempts (puzzle_id, score);
`;

export class Store {
  private db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(SCHEMA);
    // Databases created before give-up existed lack these columns.
    const columns = (this.db.prepare('PRAGMA table_info(attempts)').all() as Array<{ name: string }>).map((c) => c.name);
    const playerColumns = (this.db.prepare('PRAGMA table_info(players)').all() as Array<{ name: string }>).map((c) => c.name);
    if (!playerColumns.includes('google_id')) this.db.exec('ALTER TABLE players ADD COLUMN google_id TEXT');
    this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS players_by_google ON players (google_id)');
    if (!columns.includes('gave_up')) this.db.exec('ALTER TABLE attempts ADD COLUMN gave_up INTEGER NOT NULL DEFAULT 0');
    if (!columns.includes('final_grid')) this.db.exec('ALTER TABLE attempts ADD COLUMN final_grid TEXT');
    if (!columns.includes('hints_used')) this.db.exec('ALTER TABLE attempts ADD COLUMN hints_used INTEGER NOT NULL DEFAULT 0');
    if (!columns.includes('hinted_cells')) this.db.exec('ALTER TABLE attempts ADD COLUMN hinted_cells TEXT');
  }

  close(): void {
    this.db.close();
  }

  createPlayer(player: PlayerRow, createdAt: number): void {
    this.db
      .prepare('INSERT INTO players (id, nickname, token, created_at, google_id) VALUES (?, ?, ?, ?, ?)')
      .run(player.id, player.nickname, player.token, createdAt, player.google_id);
  }

  playerByToken(token: string): PlayerRow | undefined {
    return this.db.prepare('SELECT id, nickname, token, google_id FROM players WHERE token = ?').get(token) as
      | PlayerRow
      | undefined;
  }

  playerByGoogleId(googleId: string): PlayerRow | undefined {
    return this.db.prepare('SELECT id, nickname, token, google_id FROM players WHERE google_id = ?').get(googleId) as
      | PlayerRow
      | undefined;
  }

  linkGoogle(playerId: string, googleId: string): void {
    this.db.prepare('UPDATE players SET google_id = ? WHERE id = ?').run(googleId, playerId);
  }

  getPuzzle(id: string): PuzzleRow | undefined {
    const row = this.db.prepare('SELECT id, kind, date, difficulty, data_json FROM puzzles WHERE id = ?').get(id) as
      | { id: string; kind: 'daily' | 'practice'; date: string | null; difficulty: Difficulty; data_json: string }
      | undefined;
    if (!row) return undefined;
    return { id: row.id, kind: row.kind, date: row.date, difficulty: row.difficulty, puzzle: JSON.parse(row.data_json) };
  }

  insertPuzzle(row: PuzzleRow): void {
    this.db
      .prepare('INSERT OR IGNORE INTO puzzles (id, kind, date, difficulty, seed, data_json) VALUES (?, ?, ?, ?, ?, ?)')
      .run(row.id, row.kind, row.date, row.difficulty, row.puzzle.seed, JSON.stringify(row.puzzle));
  }

  getAttempt(playerId: string, puzzleId: string): AttemptRow | undefined {
    return this.db.prepare('SELECT * FROM attempts WHERE player_id = ? AND puzzle_id = ?').get(playerId, puzzleId) as
      | AttemptRow
      | undefined;
  }

  /** Returns the existing attempt, or starts one now. */
  startAttempt(playerId: string, puzzleId: string, now: number): AttemptRow {
    this.db
      .prepare('INSERT OR IGNORE INTO attempts (player_id, puzzle_id, started_at) VALUES (?, ?, ?)')
      .run(playerId, puzzleId, now);
    return this.getAttempt(playerId, puzzleId)!;
  }

  recordHints(attemptId: number, cells: Array<[number, number]>): void {
    this.db
      .prepare('UPDATE attempts SET hints_used = ?, hinted_cells = ? WHERE id = ?')
      .run(cells.length, JSON.stringify(cells), attemptId);
  }

  finishAttempt(attemptId: number, finishedAt: number, score: number, grid: string[]): void {
    this.db
      .prepare('UPDATE attempts SET finished_at = ?, score = ?, final_grid = ? WHERE id = ?')
      .run(finishedAt, score, JSON.stringify(grid), attemptId);
  }

  giveUpAttempt(attemptId: number, finishedAt: number, grid: string[]): void {
    this.db
      .prepare('UPDATE attempts SET finished_at = ?, score = 0, gave_up = 1, final_grid = ? WHERE id = ?')
      .run(finishedAt, JSON.stringify(grid), attemptId);
  }

  /** Submitted attempts for a puzzle, best first: higher score, then faster time. */
  leaderboard(puzzleId: string, limit: number): LeaderboardEntry[] {
    return this.db
      .prepare(
        `SELECT a.player_id, p.nickname, a.score, a.finished_at - a.started_at AS elapsed_ms
         FROM attempts a JOIN players p ON p.id = a.player_id
         WHERE a.puzzle_id = ? AND a.finished_at IS NOT NULL AND a.gave_up = 0
         ORDER BY a.score DESC, elapsed_ms ASC, a.finished_at ASC
         LIMIT ?`,
      )
      .all(puzzleId, limit) as unknown as LeaderboardEntry[];
  }

  rank(puzzleId: string, score: number, elapsedMs: number): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS better FROM attempts
         WHERE puzzle_id = ? AND finished_at IS NOT NULL AND gave_up = 0
           AND (score > ? OR (score = ? AND finished_at - started_at < ?))`,
      )
      .get(puzzleId, score, score, elapsedMs) as { better: number };
    return row.better + 1;
  }
}
