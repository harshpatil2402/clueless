import { useEffect, useState } from 'react';
import {
  DIFFICULTIES,
  MAX_HINTS,
  type DailyStatus,
  type DailyStatusResponse,
  type Difficulty,
  type PlayerSession,
} from '@crossword/shared';
import { api } from '../api';
import { AccountMenu } from '../components/AccountMenu';
import { BulbSpot, CuriousCartoon, MagnifierSpot, PencilSpot, StopwatchSpot } from '../components/Cartoons';
import { Guide } from '../components/Guide';
import { Imprint } from '../components/Imprint';
import { LevelPicker } from '../components/LevelPicker';
import { Masthead } from '../components/Masthead';
import { DIFFICULTY_LABEL } from '../format';

function playLabel(level: Difficulty, status: DailyStatus[Difficulty] | undefined): string {
  const name = DIFFICULTY_LABEL[level];
  if (status?.gaveUp) return `See ${name} answers`;
  if (status?.finished) return `Review ${name} · ${status.score} pts`;
  if (status?.started) return `Resume ${name} · clock running`;
  return `Play today's ${name}`;
}

interface HomeProps {
  player: PlayerSession;
  onSession: (player: PlayerSession) => void;
  onSignOut: () => void;
}

export function Home({ player, onSession, onSignOut }: HomeProps) {
  const [daily, setDaily] = useState<DailyStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<Difficulty>('easy');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.dailyStatus().then(
      (response) => {
        setDaily(response);
        // Open on the first level the player has not finished today.
        setLevel(DIFFICULTIES.find((difficulty) => !response.status[difficulty].finished) ?? 'easy');
      },
      (reason: Error) => setError(reason.message),
    );
  }, [player.id]);

  const startPractice = async () => {
    setCreating(true);
    try {
      const created = await api.createPractice(level);
      location.hash = `#/puzzle/${created.puzzleId}`;
    } catch (reason) {
      setError((reason as Error).message);
      setCreating(false);
    }
  };

  const status = daily?.status[level];
  return (
    <main className="page home">
      <Masthead
        date={daily?.date}
        left={<a href="#/leaderboard">Leaderboard</a>}
        right={<AccountMenu player={player} onSession={onSession} onSignOut={onSignOut} />}
      />
      <h1 className="headline">Think You Know It All? Prove It in Ink</h1>
      <p className="standfirst">Seventeen subjects. One grid. {MAX_HINTS} hints, one shot.</p>

      {error && <p className="error">{error}</p>}

      <div className="front">
        <section className="front-main">
          <h2>Start here: solve your level</h2>
          <LevelPicker selected={level} status={daily?.status} onSelect={setLevel} />
          <div className="play-row">
            <a className={status?.finished ? 'button' : 'button primary'} href={`#/daily/${level}`}>
              {playLabel(level, status)}
            </a>
            <button type="button" className="link-button" disabled={creating} onClick={startPractice}>
              {creating ? 'Building…' : `or warm up on a practice ${DIFFICULTY_LABEL[level]}, unranked`}
            </button>
          </div>
        </section>

        <aside className="front-aside">
          <CuriousCartoon />
        </aside>
      </div>

      <ol className="steps">
        <li>
          <PencilSpot />
          <span>
            <strong>Answer</strong> each clue in the grid
          </span>
        </li>
        <li>
          <MagnifierSpot />
          <span>
            <strong>{MAX_HINTS} hints</strong> reveal a letter
          </span>
        </li>
        <li>
          <StopwatchSpot />
          <span>
            <strong>Faster</strong> scores higher
          </span>
        </li>
        <li>
          <BulbSpot />
          <span>
            <strong>Submit once</strong>, any time
          </span>
        </li>
      </ol>

      <details className="rulebook">
        <summary>Read the full rulebook</summary>
        <Guide />
      </details>

      <Imprint />
    </main>
  );
}
