import { useEffect, useState } from 'react';
import { formatTime } from '../format';

interface TimerProps {
  /** Seconds already elapsed on the server when the puzzle was loaded. */
  baseSeconds: number;
  /** Set once solved: the clock freezes on the server's final time. */
  finalSeconds: number | null;
}

/** Display only; the server keeps the authoritative time. */
export function Timer({ baseSeconds, finalSeconds }: TimerProps) {
  const [loadedAt] = useState(() => Date.now());
  const [now, setNow] = useState(loadedAt);

  useEffect(() => {
    if (finalSeconds !== null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [finalSeconds]);

  const seconds = finalSeconds ?? baseSeconds + Math.floor((now - loadedAt) / 1000);
  return (
    <span className="timer" role="timer" aria-label="Elapsed time">
      {formatTime(seconds)}
    </span>
  );
}
