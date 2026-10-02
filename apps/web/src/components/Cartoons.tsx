import type { ReactNode } from 'react';

/** Pen-and-ink spot drawings, in the same loose line as the masthead face. They take the text colour. */
function Spot({ children }: { children: ReactNode }) {
  return (
    <svg
      className="spot"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const BulbSpot = () => (
  <Spot>
    <path d="M24 9c-7 0-12 5-12 11.5 0 4 2 6.800 4.800 9 1.400 1.200 2 2.400 2.200 4.500h10c.2-2.100.8-3.300 2.200-4.500 2.800-2.200 4.800-5 4.800-9C36 14 31 9 24 9z" />
    <path d="M19.500 38.500h9M21 43h6M24 2v3M8 8l2.200 2.200M40 8l-2.200 2.200M3 21h3M42 21h3" />
  </Spot>
);

export const BookSpot = () => (
  <Spot>
    <path d="M24 13c-5-3.200-10.500-3.600-17-2.400v25.800c6.500-1.200 12-.8 17 2.400 5-3.200 10.500-3.600 17-2.400V10.600c-6.500-1.200-12-.8-17 2.400z" />
    <path d="M24 13v25.800M12 17.500c2.600-.3 5 0 7.200.9M12 23.500c2.600-.3 5 0 7.200.9M29 18.400c2.200-.9 4.600-1.200 7.200-.9" />
  </Spot>
);

export const StairsSpot = () => (
  <Spot>
    <path d="M5 41h10V31.500h9.500V22H34v-9.500h9" />
    <path d="M36 6l2.500 3.500L42 6.500" />
  </Spot>
);

export const CalendarSpot = () => (
  <Spot>
    <path d="M8 11.500c10.500-.8 21.500-.8 32 0 .7 9 .7 18.500 0 27.500-10.500.8-21.500.8-32 0-.7-9-.7-18.500 0-27.500z" />
    <path d="M8 19.500h32M16 6.500v8M32 6.500v8M17 28l4.500 4.500 9-9.500" />
  </Spot>
);

export const PencilSpot = () => (
  <Spot>
    <path d="M9 39.500l2.800-10.300L32.500 8.500c1.500-1.500 3.600-1.500 5 0l2 2c1.500 1.500 1.500 3.500 0 5L18.800 36.300z" />
    <path d="M11.800 29.200l7 7M29 12l7 7M9 39.500l4.200-1.200" />
  </Spot>
);

export const MagnifierSpot = () => (
  <Spot>
    <circle cx="20" cy="20" r="12.500" />
    <path d="M29.500 29.500L42 42M16.500 16.500c.4-2.400 2-3.800 4-3.800 2.200 0 3.800 1.500 3.800 3.500 0 3-3.800 3-3.800 6.300M20.500 26.800v.2" />
  </Spot>
);

export const StopwatchSpot = () => (
  <Spot>
    <circle cx="24" cy="28" r="14.500" />
    <path d="M24 28l5.500-7M19.500 6.500h9M24 6.500v7M36 15.500l3-3M24 17.500v1.500M24 37v1.500M13.500 28H15M33 28h1.500" />
  </Spot>
);

export const TickSpot = () => (
  <Spot>
    <path d="M9 9.500c10-.9 20-.9 30 0 .9 10 .9 19 0 29-10 .9-20 .9-30 0-.9-10-.9-19 0-29z" />
    <path d="M15 24.500l7 7.500 13-16.500" />
  </Spot>
);

export const TrophySpot = () => (
  <Spot>
    <path d="M15 7.500h18c.4 7.500-.3 13-2.500 16.200-1.700 2.400-3.800 3.600-6.500 3.600s-4.800-1.200-6.500-3.600C15.300 20.500 14.600 15 15 7.500z" />
    <path d="M15 11H7.500c0 6 2.800 9.500 8.800 9.800M33 11h7.500c0 6-2.800 9.500-8.800 9.800M24 27.300V34M18.500 34h11l1.500 7h-14zM14 41h20" />
  </Spot>
);

/** Single-panel pocket cartoon: a solver stumped by a clue whose answer is the game's own name. */
export function PocketCartoon() {
  return (
    <figure className="pocket-cartoon">
      <svg
        viewBox="0 0 260 210"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        role="img"
        aria-label="Cartoon of a puzzled solver scratching their head over a crossword"
      >
        {/* floor shadow and desk */}
        <path d="M22 151c70-2.500 146-2.500 216 0" />
        <path d="M40 152l-5 46M220 152l5 46" />

        {/* body and shoulders */}
        <path d="M84 150c3-27 15-43 36-45 6-.6 12-.6 18 0 21 2 33 18 36 45" />
        {/* collar */}
        <path d="M119 106l10 11 11-11" />

        {/* head */}
        <path d="M100 68c0-19 13-32 30-32s30 13 30 32-13 34-30 34-30-15-30-34z" />
        {/* hair tuft */}
        <path d="M118 38c-2-9 3-15 9-17M129 36c1-8 6-12 12-12M139 39c4-6 9-8 14-6" />
        {/* worried brows */}
        <path d="M112 60l11-5M137 55l11 5" />
        {/* eyes looking down at the paper */}
        <path d="M118 69v2M142 69v2" strokeWidth="5" />
        {/* wobbly mouth */}
        <path d="M119 86c3.500-3 6.500 3 10 0s6.500 3 10 0" />
        {/* ear */}
        <path d="M160 68c5-2 8 2 7 7-.8 3.500-3.500 5-7 4" />

        {/* arm scratching the head */}
        <path d="M168 128c14-10 22-28 18-52-.8-5-3-9-7-12" />
        <path d="M179 64c-4-5-10-5-13-1M176 59c-2-5-7-7-11-4M184 70c-3-1-6 0-8 2" />

        {/* other arm resting on the desk, holding a pencil */}
        <path d="M90 128c-12 4-22 10-30 20" />
        <path d="M52 143l34-26 5 6-34 26-8 3z" />

        {/* newspaper with a tiny crossword */}
        <path d="M96 150l8-22 74-2 8 24" />
        <g strokeWidth="2">
          <path d="M116 133h44l5 13h-54zM121 139.500h41M127 133l-3 13M138 133v13M149 133l3 13" />
          <path d="M127 133h11l0 6.500h-12.500zM149 139.500h11.500l2.500 6.500h-11z" fill="currentColor" />
        </g>

        {/* sweat drops */}
        <path d="M88 52c-3 4-3 7 0 8s4-3 0-8zM80 70c-2.500 3.500-2.500 6 0 7s3.500-2.500 0-7z" strokeWidth="2.400" />

        {/* question marks */}
        <g fill="currentColor" stroke="none" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700">
          <text x="46" y="52" fontSize="40" transform="rotate(-16 46 52)">?</text>
          <text x="196" y="40" fontSize="30" transform="rotate(14 196 40)">?</text>
          <text x="216" y="84" fontSize="20" transform="rotate(24 216 84)">?</text>
          <text x="22" y="92" fontSize="20" transform="rotate(-28 22 92)">?</text>
        </g>
      </svg>
      <figcaption>
        “Seven across: ‘Without the faintest idea’, eight letters… <em>no idea.</em>”
      </figcaption>
    </figure>
  );
}
