import type {
  DailyStatusResponse,
  Difficulty,
  GiveUpResponse,
  HintResponse,
  LeaderboardResponse,
  PlayerSession,
  PuzzleResponse,
  SubmitResponse,
} from '@crossword/shared';
import { clearPlayer, loadPlayer } from './storage';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const player = loadPlayer();
  if (player) headers.authorization = `Bearer ${player.token}`;
  if (init.body !== undefined) headers['content-type'] = 'application/json';

  const response = await fetch(path, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!response.ok) {
    if (response.status === 401 && player) {
      // Stored token is no longer known to the server: start over as a new guest.
      clearPlayer();
      location.reload();
    }
    const detail = await response.json().catch(() => null);
    throw new ApiError(response.status, detail?.error ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  createPlayer: (nickname: string) => request<PlayerSession>('/api/players', { method: 'POST', body: { nickname } }),
  dailyStatus: () => request<DailyStatusResponse>('/api/puzzles/daily/status'),
  daily: (difficulty: Difficulty) => request<PuzzleResponse>(`/api/puzzles/daily?difficulty=${difficulty}`),
  createPractice: (difficulty: Difficulty) =>
    request<PuzzleResponse>('/api/puzzles/practice', { method: 'POST', body: { difficulty } }),
  puzzle: (id: string) => request<PuzzleResponse>(`/api/puzzles/${encodeURIComponent(id)}`),
  submit: (id: string, grid: string[]) =>
    request<SubmitResponse>(`/api/puzzles/${encodeURIComponent(id)}/submit`, { method: 'POST', body: { grid } }),
  hint: (id: string, row: number, col: number) =>
    request<HintResponse>(`/api/puzzles/${encodeURIComponent(id)}/hint`, { method: 'POST', body: { row, col } }),
  giveUp: (id: string, grid: string[]) =>
    request<GiveUpResponse>(`/api/puzzles/${encodeURIComponent(id)}/giveup`, { method: 'POST', body: { grid } }),
  leaderboard: (difficulty: Difficulty) => request<LeaderboardResponse>(`/api/leaderboard?difficulty=${difficulty}`),
};
