import type { ReactNode } from 'react';

/** "2026-10-01" → "Thursday, 1 October 2026"; today's local date when no ISO date is given. */
function longDate(isoDate?: string | null): string {
  const date = isoDate ? new Date(`${isoDate}T00:00:00Z`) : new Date();
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: isoDate ? 'UTC' : undefined,
  });
}

interface MastheadProps {
  /** Dateline, left side: edition or section name. */
  left?: ReactNode;
  /** Dateline, right side: timer on the game page. */
  right?: ReactNode;
  date?: string | null;
}

export function Masthead({ left, right, date }: MastheadProps) {
  return (
    <header className="masthead">
      <a className="masthead-title" href="#/">
        Clueless
      </a>
      <div className="dateline">
        <span className="dateline-left">{left}</span>
        <span className="dateline-date">{longDate(date)}</span>
        <span className="dateline-right">{right}</span>
      </div>
    </header>
  );
}
