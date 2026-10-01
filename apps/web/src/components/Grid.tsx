import type { CSSProperties } from 'react';
import type { Crossword } from '../hooks/useCrossword';

interface GridProps {
  crossword: Crossword;
  /** "row,col" keys of cells the player got wrong or left empty, shown after giving up. */
  missed?: Set<string>;
}

export function Grid({ crossword, missed }: GridProps) {
  const { cells, letters, cursor, activeCells, selectCell } = crossword;
  const active = new Set(activeCells.map(([row, col]) => `${row},${col}`));
  const shape = { '--cols': cells[0].length, '--rows': cells.length } as CSSProperties;

  return (
    // The wrapper measures the free space; the grid then takes the largest size that fits it.
    <div className="grid-area" style={shape}>
      <div className="grid" role="grid" aria-label="Crossword grid">
        {cells.map((row, r) =>
          row.map((info, c) => {
            if (!info) return <div key={`${r},${c}`} className="cell block" />;
            const classes = ['cell'];
            if (active.has(`${r},${c}`)) classes.push('in-word');
            if (cursor.row === r && cursor.col === c) classes.push('cursor');
            if (missed?.has(`${r},${c}`)) classes.push('missed');
            return (
              <button
                key={`${r},${c}`}
                type="button"
                className={classes.join(' ')}
                tabIndex={-1}
                aria-label={`Row ${r + 1}, column ${c + 1}${letters[r][c] ? `, ${letters[r][c]}` : ', empty'}`}
                onClick={() => selectCell(r, c)}
              >
                {info.number !== undefined && <span className="cell-number">{info.number}</span>}
                {letters[r][c]}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
