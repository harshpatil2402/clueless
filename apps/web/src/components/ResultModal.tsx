import type { SubmitResponse } from '@crossword/shared';
import { formatTime } from '../format';

export function ResultModal({ result, onClose }: { result: SubmitResponse; onClose: () => void }) {
  const solvedAll = result.correctEntries === result.totalEntries;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Puzzle result" onClick={(e) => e.stopPropagation()}>
        <h2>{solvedAll ? 'Solved!' : 'Submitted'}</h2>
        <p className="score">{result.score}</p>
        <p className="muted">points</p>
        <dl className="stats">
          <div>
            <dt>Correct</dt>
            <dd>
              {result.correctEntries} / {result.totalEntries}
            </dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{formatTime(result.elapsedSeconds)}</dd>
          </div>
          <div>
            <dt>Hints</dt>
            <dd>{result.hintsUsed}</dd>
          </div>
          {result.rank !== null && (
            <div>
              <dt>Rank today</dt>
              <dd>#{result.rank}</dd>
            </div>
          )}
        </dl>
        <div className="modal-actions">
          <button type="button" className="button primary" onClick={onClose}>
            {solvedAll ? 'View grid' : 'See answers'}
          </button>
          {result.rank !== null && (
            <a className="button" href="#/leaderboard">
              Leaderboard
            </a>
          )}
          <a className="button" href="#/">
            Front page
          </a>
        </div>
      </div>
    </div>
  );
}
