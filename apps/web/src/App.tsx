import { useEffect, useState, type FormEvent } from 'react';
import { DIFFICULTIES, type PlayerSession } from '@crossword/shared';
import { api } from './api';
import { PocketCartoon } from './components/Cartoons';
import { GoogleButton } from './components/GoogleButton';
import { Masthead } from './components/Masthead';
import { Game, type GameTarget } from './pages/Game';
import { Home } from './pages/Home';
import { Leaderboard } from './pages/Leaderboard';
import { clearPlayer, loadPlayer, savePlayer } from './storage';

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

function Welcome({ onSession }: { onSession: (player: PlayerSession) => void }) {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async (request: Promise<PlayerSession>) => {
    setBusy(true);
    setError(null);
    try {
      onSession(await request);
    } catch (reason) {
      setError((reason as Error).message);
      setBusy(false);
    }
  };

  const joinAsGuest = (event: FormEvent) => {
    event.preventDefault();
    void start(api.createPlayer(nickname));
  };

  return (
    <main className="page">
      <Masthead left="Welcome" />
      <div className="welcome-cartoon">
        <PocketCartoon />
      </div>
      <h1 className="headline">Extra! Extra! Brains Wanted</h1>
      <p className="standfirst">Quiz knowledge in crossword form. Sign in to keep your scores, or just pick a nickname.</p>

      <div className="join">
        <h2 className="join-title">Collect Your Press Pass</h2>
        <GoogleButton
          prominent
          label="signin_with"
          onCredential={(credential) => void start(api.googleSignIn(credential))}
        />
        <p className="join-or">or play as a guest</p>
        <form className="welcome-form" onSubmit={joinAsGuest}>
          <input
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
        <p className="muted small">Guest scores stay in this browser only. You can link Google later.</p>
        {error && <p className="error">{error}</p>}
      </div>

    </main>
  );
}

export function App() {
  const [player, setPlayer] = useState(loadPlayer);
  const route = useRoute();

  const onSession = (session: PlayerSession) => {
    savePlayer(session);
    setPlayer(session);
  };
  const signOut = () => {
    clearPlayer();
    setPlayer(null);
    location.hash = '#/';
  };

  if (!player) return <Welcome onSession={onSession} />;
  if (route.page === 'leaderboard') return <Leaderboard />;
  if (route.page === 'game') return <Game target={route.target} />;
  return <Home player={player} onSession={onSession} onSignOut={signOut} />;
}
