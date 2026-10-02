import type { CSSProperties } from 'react';
import { DIFFICULTY_CONFIG, type DailyStatus, type Difficulty } from '@crossword/shared';
import { DIFFICULTY_LABEL } from '../format';

/** The three level names laid out as a real little crossword: HARD and EASY hang off MEDIUM. */
const WORDS: Array<{ level: Difficulty; word: string; row: number; col: number; down: boolean; label: string }> = [
  { level: 'hard', word: 'HARD', row: 0, col: 2, down: true, label: '1 Down' },
  { level: 'medium', word: 'MEDIUM', row: 3, col: 0, down: false, label: '2 Across' },
  { level: 'easy', word: 'EASY', row: 3, col: 1, down: true, label: '3 Down' },
];
const ROWS = 7;
const COLS = 6;
const NUMBERS: Record<string, number> = { '0,2': 1, '3,0': 2, '3,1': 3 };

interface MiniCell {
  letter: string;
  /** Levels whose word passes through this cell; a crossing cell has two. */
  levels: Difficulty[];
}

function buildCells(): Map<string, MiniCell> {
  const cells = new Map<string, MiniCell>();
  for (const { level, word, row, col, down } of WORDS) {
    [...word].forEach((letter, i) => {
      const key = down ? `${row + i},${col}` : `${row},${col + i}`;
      const cell = cells.get(key) ?? { letter, levels: [] };
      cell.levels.push(level);
      cells.set(key, cell);
    });
  }
  return cells;
}
const CELLS = buildCells();

interface LevelPickerProps {
  selected: Difficulty;
  status?: DailyStatus;
  onSelect: (level: Difficulty) => void;
}

export function LevelPicker({ selected, status, onSelect }: LevelPickerProps) {
  const grid = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const key = `${row},${col}`;
      const cell = CELLS.get(key);
      if (!cell) {
        grid.push(<span key={key} className="mini-cell mini-block" />);
        continue;
      }
      // A crossing cell keeps the current level if it is one of its two, as clicking a real grid would.
      const target = cell.levels.includes(selected) && cell.levels.length > 1
        ? cell.levels.find((level) => level !== selected)!
        : cell.levels[cell.levels.length - 1];
      grid.push(
        <button
          key={key}
          type="button"
          className={cell.levels.includes(selected) ? 'mini-cell active' : 'mini-cell'}
          aria-label={`Choose ${DIFFICULTY_LABEL[target]}`}
          onClick={() => onSelect(target)}
        >
          {NUMBERS[key] && <span className="mini-number">{NUMBERS[key]}</span>}
          {cell.letter}
        </button>,
      );
    }
  }

  return (
    <div className="level-picker">
      <div className="mini-grid" style={{ '--cols': COLS } as CSSProperties}>
        {grid}
      </div>
      <ol className="mini-clues">
        {WORDS.map(({ level, label }) => {
          const config = DIFFICULTY_CONFIG[level];
          const done = status?.[level];
          return (
            <li key={level}>
              <button
                type="button"
                className={level === selected ? 'mini-clue active' : 'mini-clue'}
                onClick={() => onSelect(level)}
              >
                <strong>{label}</strong>
                <span>
                  {config.maxSize}×{config.maxSize} grid, about {config.targetWords} words ({DIFFICULTY_LABEL[level].length})
                </span>
                {done?.finished && <span className="tag">{done.gaveUp ? 'Gave up' : `${done.score} pts`}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
