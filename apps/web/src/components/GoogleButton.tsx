import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

interface GoogleIdentity {
  initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
  renderButton(element: HTMLElement, options: Record<string, unknown>): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

let scriptLoading: Promise<void> | null = null;

/** Loads Google's sign-in script once, however many buttons ask for it. */
function loadGoogleScript(): Promise<void> {
  scriptLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoading = null;
      reject(new Error('Google sign-in failed to load'));
    };
    document.head.append(script);
  });
  return scriptLoading;
}

interface GoogleButtonProps {
  label: 'signin_with' | 'continue_with';
  /** Receives Google's signed proof of identity, to be checked by the server. */
  onCredential: (credential: string) => void;
  /** Large black button for the sign-in screen; the default is a quieter outline for inline use. */
  prominent?: boolean;
}

/** Google's own button. Renders nothing when sign-in is not configured or the script is blocked. */
export function GoogleButton({ label, onCredential, prominent = false }: GoogleButtonProps) {
  const holder = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);
  const callback = useRef(onCredential);
  callback.current = onCredential;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { googleClientId } = await api.config();
      if (!googleClientId) throw new Error('Google sign-in is not configured');
      await loadGoogleScript();
      if (cancelled || !holder.current || !window.google) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => callback.current(response.credential),
      });
      // Google draws the button itself and allows only these few styling choices.
      window.google.accounts.id.renderButton(holder.current, {
        theme: prominent ? 'filled_black' : 'outline',
        size: 'large',
        shape: 'rectangular',
        text: label,
        logo_alignment: 'left',
        ...(prominent ? { width: 320 } : {}),
      });
    })().catch(() => {
      if (!cancelled) setUnavailable(true);
    });
    return () => {
      cancelled = true;
    };
  }, [label, prominent]);

  if (unavailable) return null;
  return <div ref={holder} className="google-button" />;
}
