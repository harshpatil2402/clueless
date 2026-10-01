import { useCallback, useEffect, useMemo, useState } from 'react';
import { BLOCK, EMPTY, entryCells, type Direction, type PublicPuzzle } from '@crossword/shared';
import { loadGrid, saveGrid } from '../storage';

export interface CellInfo {
  number?: number;
  /** Index into puzzle.entries of the across / down entry covering this cell. */
  across?: number;
  down?: number;
}

export interface Cursor {
  row: number;
  col: number;
}

function buildCells(puzzle: PublicPuzzle): (CellInfo | null)[][] {
  const cells: (CellInfo | null)[][] = Array.from({ length: puzzle.rows }, () => Array(puzzle.cols).fill(null));
  puzzle.entries.forEach((entry, index) => {
    entryCells(entry, entry.length).forEach(([row, col], i) => {
      const info = (cells[row][col] ??= {});
      info[entry.direction] = index;
      if (i === 0) info.number = entry.number;
    });
  });
  return cells;
}

function initialLetters(puzzle: PublicPuzzle, puzzleId: string, solution: string[] | null): string[][] {
  if (solution) return solution.map((row) => [...row].map((char) => (char === BLOCK ? '' : char)));
  const saved = loadGrid(puzzleId);
  if (saved && saved.length === puzzle.rows && saved.every((row) => row.length === puzzle.cols)) return saved;
  return Array.from({ length: puzzle.rows }, () => Array<string>(puzzle.cols).fill(''));
}

export function useCrossword(puzzle: PublicPuzzle, puzzleId: string, solution: string[] | null) {
  const cells = useMemo(() => buildCells(puzzle), [puzzle]);
  const [letters, setLetters] = useState(() => initialLetters(puzzle, puzzleId, solution));
  const [cursor, setCursor] = useState<Cursor>({ row: puzzle.entries[0].row, col: puzzle.entries[0].col });
  const [direction, setDirection] = useState<Direction>(puzzle.entries[0].direction);
  const [readOnly, setReadOnly] = useState(solution !== null);

  useEffect(() => {
    if (!readOnly) saveGrid(puzzleId, letters);
  }, [letters, puzzleId, readOnly]);

  const cell = cells[cursor.row][cursor.col]!;
  const activeIndex = (cell[direction] ?? cell.across ?? cell.down)!;
  const activeEntry = puzzle.entries[activeIndex];
  const activeCells = useMemo(() => entryCells(activeEntry, activeEntry.length), [activeEntry]);

  const isFull = cells.every((row, r) => row.every((info, c) => info === null || letters[r][c] !== ''));

  const setLetter = (row: number, col: number, letter: string) =>
    setLetters((previous) => previous.map((line, r) => (r === row ? line.map((old, c) => (c === col ? letter : old)) : line)));

  const selectEntry = useCallback(
    (index: number) => {
      const entry = puzzle.entries[index];
      const path = entryCells(entry, entry.length);
      const [row, col] = path.find(([r, c]) => letters[r][c] === '') ?? path[0];
      setCursor({ row, col });
      setDirection(entry.direction);
    },
    [puzzle, letters],
  );

  const selectCell = (row: number, col: number) => {
    const target = cells[row][col];
    if (!target) return;
    const other: Direction = direction === 'across' ? 'down' : 'across';
    if (row === cursor.row && col === cursor.col) {
      // Tapping the current cell again flips direction where two entries cross.
      if (target[other] !== undefined) setDirection(other);
      return;
    }
    setCursor({ row, col });
    if (target[direction] === undefined) setDirection(other);
  };

  const toggleDirection = () => {
    const other: Direction = direction === 'across' ? 'down' : 'across';
    if (cell[other] !== undefined) setDirection(other);
  };

  const typeLetter = (letter: string) => {
    if (readOnly) return;
    setLetter(cursor.row, cursor.col, letter.toUpperCase());
    const position = activeCells.findIndex(([r, c]) => r === cursor.row && c === cursor.col);
    const next = activeCells[position + 1];
    if (next) setCursor({ row: next[0], col: next[1] });
  };

  const backspace = () => {
    if (readOnly) return;
    if (letters[cursor.row][cursor.col] !== '') {
      setLetter(cursor.row, cursor.col, '');
      return;
    }
    const position = activeCells.findIndex(([r, c]) => r === cursor.row && c === cursor.col);
    const previous = activeCells[position - 1];
    if (previous) {
      setLetter(previous[0], previous[1], '');
      setCursor({ row: previous[0], col: previous[1] });
    }
  };

  /** Arrow keys: jump to the next open cell in that direction, skipping blocks. */
  const move = (dRow: number, dCol: number) => {
    let row = cursor.row + dRow;
    let col = cursor.col + dCol;
    while (row >= 0 && row < puzzle.rows && col >= 0 && col < puzzle.cols) {
      const target = cells[row][col];
      if (target) {
        setCursor({ row, col });
        const axis: Direction = dRow === 0 ? 'across' : 'down';
        const other: Direction = axis === 'across' ? 'down' : 'across';
        setDirection(target[axis] !== undefined ? axis : other);
        return;
      }
      row += dRow;
      col += dCol;
    }
  };

  const stepEntry = (delta: number) => {
    const count = puzzle.entries.length;
    selectEntry((activeIndex + delta + count) % count);
  };

  /** Rows as sent to the server: BLOCK outside entries, EMPTY for unfilled cells. */
  const toGrid = () =>
    cells.map((row, r) => row.map((info, c) => (info === null ? BLOCK : letters[r][c] || EMPTY)).join(''));

  const showSolution = (solved: string[]) => {
    setLetters(solved.map((row) => [...row].map((char) => (char === BLOCK ? '' : char))));
    setReadOnly(true);
  };

  return {
    cells,
    letters,
    cursor,
    direction,
    activeIndex,
    activeEntry,
    activeCells,
    isFull,
    readOnly,
    selectCell,
    selectEntry,
    toggleDirection,
    typeLetter,
    backspace,
    move,
    stepEntry,
    toGrid,
    showSolution,
  };
}

export type Crossword = ReturnType<typeof useCrossword>;
