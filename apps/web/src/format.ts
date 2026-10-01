import type { Category, Difficulty } from '@crossword/shared';

export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  history: 'History',
  geography: 'Geography',
  biology: 'Biology',
  maths: 'Maths',
  physics: 'Physics',
  chemistry: 'Chemistry',
  english: 'English',
  art: 'Art',
  music: 'Music',
  astronomy: 'Astronomy',
  sports: 'Sports',
  movies: 'Films',
  series: 'Series',
  books: 'Books',
  gk: 'GK',
  currentaffairs: 'Current Affairs',
  puns: 'Puns',
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};
