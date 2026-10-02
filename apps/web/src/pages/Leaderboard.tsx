import { useEffect, useState } from 'react';
import { DIFFICULTIES, type Difficulty, type LeaderboardResponse } from '@crossword/shared';
import { api } from '../api';
import { Masthead } from '../components/Masthead';
import { DIFFICULTY_LABEL, formatTime } from '../format';

export function Leaderboard() {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBoard(null);
    api.leaderboard(difficulty).then(
      (response) => !cancelled && setBoard(response),
      (reason: Error) => !cancelled && setError(reason.message),
    );
    return () => {
      cancelled = true;
    };
  }, [difficulty]);

  return (
    <main className="page">
      <Masthead date={board?.date} left={<a href="#/">← Front page</a>} right="Leaderboard" />

      <h1 className="headline">Hall of Fame: Today's Sharpest Pencils</h1>

      <div className="tabs" role="tablist">
        {DIFFICULTIES.map((level) => (
          <button
            key={level}
            type="button"
            role="tab"
            aria-selected={level === difficulty}
            className={level === difficulty ? 'tab active' : 'tab'}
            onClick={() => setDifficulty(level)}
          >
            {DIFFICULTY_LABEL[level]}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      {board && board.rows.length === 0 && <p className="muted">Nobody has cracked this grid yet today. The top spot is yours for the taking.</p>}
      {board && board.rows.length > 0 && (
        <table className="leaderboard">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Score</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {board.rows.map((row) => (
              <tr key={row.rank} className={row.you ? 'you' : undefined}>
                <td>{row.rank}</td>
                <td>
                  {row.nickname}
                  {row.you && ' (you)'}
                </td>
                <td>{row.score}</td>
                <td>{formatTime(row.elapsedSeconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
