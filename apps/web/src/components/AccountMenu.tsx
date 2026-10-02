import { useState } from 'react';
import type { PlayerSession } from '@crossword/shared';
import { api } from '../api';
import { GoogleButton } from './GoogleButton';

interface AccountMenuProps {
  player: PlayerSession;
  onSession: (player: PlayerSession) => void;
  onSignOut: () => void;
}

/** The player's name in the dateline; opening it shows sign-out, or the Google link for guests. */
export function AccountMenu({ player, onSession, onSignOut }: AccountMenuProps) {
  const [error, setError] = useState<string | null>(null);
  const linkGoogle = (credential: string) =>
    api.googleSignIn(credential).then(onSession, (reason: Error) => setError(reason.message));

  return (
    <details className="account-menu">
      <summary>{player.nickname} ▾</summary>
      <div className="account-pop">
        {player.google ? (
          <>
            <p>Signed in with Google. Scores follow you to any device.</p>
            <button type="button" className="button" onClick={onSignOut}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <p>Playing as a guest. Scores live only in this browser; link Google to keep them.</p>
            <GoogleButton label="continue_with" onCredential={linkGoogle} />
          </>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </details>
  );
}
