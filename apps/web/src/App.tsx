import { useEffect, useState, type FormEvent } from 'react';
import { DIFFICULTIES, type PlayerSession } from '@crossword/shared';
import { api } from './api';
import { PocketCartoon } from './components/Cartoons';
import { Guide } from './components/Guide';
import { Masthead } from './components/Masthead';
import { Game, type GameTarget } from './pages/Game';
import { Home } from './pages/Home';
import { Leaderboard } from './pages/Leaderboard';
import { loadPlayer, savePlayer } from './storage';

type Route = { page: 'home' } | { page: 'leaderboard' } | { page: 'game'; target: GameTarget };

function parseRoute(hash: string): Route {
  const [, page, argument] = hash.replace(/^#/, '').split('/');
  if (page === 'leaderboard') return { page: 'leaderboard' };
  if (page === 'daily') {
    const difficulty = DIFFICULTIES.find((level) => level === argument);
    if (difficulty) return { page: 'game', target: { kind: 'daily', difficulty } };
  }
  if (page === 'puzzle' && argument) return { page: 'game', target: { kind: 'puzzle', id: argument } };
  return { page: 'home' };
}

function useRoute(): Route {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const onChange = () => setHash(location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return parseRoute(hash);
}

function Welcome({ onJoined }: { onJoined: (player: PlayerSession) => void }) {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const join = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const player = await api.createPlayer(nickname);
      savePlayer(player);
      onJoined(player);
    } catch (reason) {
      setError((reason as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <Masthead left="Welcome" />
      <h1 className="headline">Extra! Extra! Brains Wanted</h1>
      <p className="standfirst">Quiz knowledge in crossword form. Pick a nickname for the leaderboard and step up.</p>
      <form className="welcome-form" onSubmit={join}>
        <input
          autoFocus
          value={nickname}
          maxLength={20}
          placeholder="Nickname"
          aria-label="Nickname"
          onChange={(event) => setNickname(event.target.value)}
        />
        <button type="submit" className="button primary" disabled={busy || nickname.trim() === ''}>
          Start
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      <div className="welcome-cartoon">
        <PocketCartoon />
      </div>
      <Guide />
    </main>
  );
}

export function App() {
  const [player, setPlayer] = useState(loadPlayer);
  const route = useRoute();

  if (!player) return <Welcome onJoined={setPlayer} />;
  if (route.page === 'leaderboard') return <Leaderboard />;
  if (route.page === 'game') return <Game target={route.target} />;
  return <Home player={player} />;
}
