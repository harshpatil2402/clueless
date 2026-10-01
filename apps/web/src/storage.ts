import type { PlayerSession } from '@crossword/shared';

// localStorage can throw (private mode, blocked site data), so every access is guarded.

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Progress simply is not persisted.
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to clean up.
  }
}

const PLAYER_KEY = 'cw:player';
const gridKey = (puzzleId: string) => `cw:grid:${puzzleId}`;

export const loadPlayer = () => read<PlayerSession>(PLAYER_KEY);
export const savePlayer = (player: PlayerSession) => write(PLAYER_KEY, player);
export const clearPlayer = () => remove(PLAYER_KEY);

export const loadGrid = (puzzleId: string) => read<string[][]>(gridKey(puzzleId));
export const saveGrid = (puzzleId: string, letters: string[][]) => write(gridKey(puzzleId), letters);
export const clearGrid = (puzzleId: string) => remove(gridKey(puzzleId));
