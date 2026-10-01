import { useEffect, useState } from 'react';
import { DIFFICULTIES, DIFFICULTY_CONFIG, type DailyStatusResponse, type Difficulty, type Player } from '@crossword/shared';
import { api } from '../api';
import { Masthead } from '../components/Masthead';
import { DIFFICULTY_LABEL } from '../format';

function describe(difficulty: Difficulty): string {
  const config = DIFFICULTY_CONFIG[difficulty];
  return `Up to ${config.maxSize}×${config.maxSize} · about ${config.targetWords} words`;
}

export function Home({ player }: { player: Player }) {
  const [daily, setDaily] = useState<DailyStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<Difficulty | null>(null);

  useEffect(() => {
    api.dailyStatus().then(setDaily, (reason: Error) => setError(reason.message));
  }, []);

  const startPractice = async (difficulty: Difficulty) => {
    setCreating(difficulty);
    try {
      const created = await api.createPractice(difficulty);
      location.hash = `#/puzzle/${created.puzzleId}`;
    } catch (reason) {
      setError((reason as Error).message);
      setCreating(null);
    }
  };

  return (
    <main className="page home">
      <Masthead date={daily?.date} left="Front page" right={player.nickname} />
      <p className="standfirst">
        Seventeen school subjects and pastimes, from history to sport to puns, crossed in one grid. No hints, no mercy.
      </p>

      {error && <p className="error">{error}</p>}

      <section>
        <div className="section-title">
          <h2>Today's puzzles</h2>
          <span className="muted">Clock starts when the puzzle opens · one attempt per level</span>
        </div>
        <div className="cards">
          {DIFFICULTIES.map((difficulty) => {
            const status = daily?.status[difficulty];
            return (
              <a key={difficulty} className="card" href={`#/daily/${difficulty}`}>
                <h3>{DIFFICULTY_LABEL[difficulty]}</h3>
                <p className="muted">{describe(difficulty)}</p>
                <p className="card-status">
                  {status?.gaveUp ? 'Gave up · see answers' : status?.finished ? `Solved · ${status.score} pts` : status?.started ? 'In progress · clock running' : 'Play'}
                </p>
              </a>
            );
          })}
        </div>
      </section>

      <section>
        <div className="section-title">
          <h2>Practice</h2>
          <span className="muted">Fresh random puzzle, not ranked</span>
        </div>
        <div className="cards">
          {DIFFICULTIES.map((difficulty) => (
            <button
              key={difficulty}
              type="button"
              className="card"
              disabled={creating !== null}
              onClick={() => startPractice(difficulty)}
            >
              <h3>{DIFFICULTY_LABEL[difficulty]}</h3>
              <p className="muted">{describe(difficulty)}</p>
              <p className="card-status">{creating === difficulty ? 'Building…' : 'New puzzle'}</p>
            </button>
          ))}
        </div>
      </section>

      <a className="button" href="#/leaderboard">
        Today's leaderboard →
      </a>
    </main>
  );
}
