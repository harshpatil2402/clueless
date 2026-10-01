import type { SubmitResponse } from '@crossword/shared';
import { formatTime } from '../format';

type Solved = Extract<SubmitResponse, { solved: true }>;

export function ResultModal({ result, onClose }: { result: Solved; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Puzzle solved" onClick={(e) => e.stopPropagation()}>
        <h2>Solved!</h2>
        <p className="score">{result.score}</p>
        <p className="muted">points</p>
        <dl className="stats">
          <div>
            <dt>Time</dt>
            <dd>{formatTime(result.elapsedSeconds)}</dd>
          </div>
          <div>
            <dt>Wrong submits</dt>
            <dd>{result.wrongSubmits}</dd>
          </div>
          {result.rank !== null && (
            <div>
              <dt>Rank today</dt>
              <dd>#{result.rank}</dd>
            </div>
          )}
        </dl>
        <div className="modal-actions">
          {result.rank !== null && (
            <a className="button primary" href="#/leaderboard">
              Leaderboard
            </a>
          )}
          <a className="button" href="#/">
            Front page
          </a>
          <button type="button" className="button" onClick={onClose}>
            View grid
          </button>
        </div>
      </div>
    </div>
  );
}
