import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, type ClueEntry, type ClueLevel } from '@crossword/shared';

const DEFAULT_DIR = fileURLToPath(new URL('../data/clues/', import.meta.url));

const MIN_LENGTH = 3;
const MAX_LENGTH = 13;

interface RawClue {
  answer: string;
  clue: string;
  difficulty: number;
}

/** Reads one JSON file per category and rejects malformed or duplicate entries. */
export function loadClueBank(dir: string = DEFAULT_DIR): ClueEntry[] {
  const clues: ClueEntry[] = [];
  const seen = new Map<string, string>();

  for (const category of CATEGORIES) {
    const raw = JSON.parse(readFileSync(`${dir}/${category}.json`, 'utf8')) as RawClue[];
    for (const item of raw) {
      const where = `${category}.json "${item.answer}"`;
      if (typeof item.answer !== 'string' || !/^[A-Z]+$/.test(item.answer)) {
        throw new Error(`${where}: answer must be uppercase A-Z only`);
      }
      if (item.answer.length < MIN_LENGTH || item.answer.length > MAX_LENGTH) {
        throw new Error(`${where}: answer length must be ${MIN_LENGTH}-${MAX_LENGTH}`);
      }
      if (typeof item.clue !== 'string' || item.clue.trim() === '') {
        throw new Error(`${where}: clue is empty`);
      }
      if (![1, 2, 3].includes(item.difficulty)) {
        throw new Error(`${where}: difficulty must be 1, 2 or 3`);
      }
      // Multi-word answers carry a letter pattern such as "(4,4)" that must add up.
      const pattern = item.clue.match(/\((\d+(?:,\d+)+)\)\s*$/);
      if (pattern) {
        const total = pattern[1].split(',').reduce((sum, part) => sum + Number(part), 0);
        if (total !== item.answer.length) throw new Error(`${where}: letter pattern does not match answer length`);
      }
      const previous = seen.get(item.answer);
      if (previous) throw new Error(`${where}: duplicate answer, already in ${previous}.json`);
      seen.set(item.answer, category);

      clues.push({
        id: `${category}-${item.answer.toLowerCase()}`,
        answer: item.answer,
        clue: item.clue,
        category,
        difficulty: item.difficulty as ClueLevel,
      });
    }
  }
  return clues;
}
