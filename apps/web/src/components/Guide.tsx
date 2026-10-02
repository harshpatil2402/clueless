import { CATEGORIES, DIFFICULTIES, DIFFICULTY_CONFIG, HINT_PENALTY, MAX_HINTS } from '@crossword/shared';
import { CATEGORY_LABEL, DIFFICULTY_LABEL } from '../format';
import {
  BookSpot,
  BulbSpot,
  CalendarSpot,
  MagnifierSpot,
  PencilSpot,
  StairsSpot,
  StopwatchSpot,
  TickSpot,
  TrophySpot,
} from './Cartoons';

const SCHOOL_STAGE = {
  easy: 'primary-school level (grades 1–5)',
  medium: 'up to middle-school level (grades 1–9)',
  hard: 'middle and senior school level (grades 6–12)',
} as const;

/** Everything a new player needs, set like a newspaper column. Numbers come from the game's own rules. */
export function Guide() {
  return (
    <section className="guide-section">
      <div className="guide">
        <article className="lead">
          <h3>
            <BulbSpot />
            <span>
              <span className="kicker">The idea</span>
              Quiz Meets Crossword, Sparks Fly
            </span>
          </h3>
          <p>
            Clueless is a crossword in which every clue is a quiz question. Know the answer, write it in the grid, and
            the letters you place help with the words that cross it. One grid mixes many subjects: an Across clue may be
            chemistry while the Down clue through it is cricket.
          </p>
        </article>

        <article>
          <h3>
            <BookSpot />
            <span>
              <span className="kicker">What it covers</span>
              From Atoms to Zingers
            </span>
          </h3>
          <p>{CATEGORIES.length} fields, drawn roughly from school books of grades 1 to 12 plus a few pastimes:</p>
          <p className="guide-fields">{CATEGORIES.map((category) => CATEGORY_LABEL[category]).join(' · ')}</p>
          <p>Each clue carries a small label naming its field.</p>
        </article>

        <article>
          <h3>
            <StairsSpot />
            <span>
              <span className="kicker">Levels</span>
              Pick Your Poison
            </span>
          </h3>
          <ul>
            {DIFFICULTIES.map((difficulty) => {
              const config = DIFFICULTY_CONFIG[difficulty];
              return (
                <li key={difficulty}>
                  <strong>{DIFFICULTY_LABEL[difficulty]}</strong>: about {config.targetWords} words on a grid up to{' '}
                  {config.maxSize}×{config.maxSize}, {SCHOOL_STAGE[difficulty]}.
                </li>
              );
            })}
          </ul>
        </article>

        <article>
          <h3>
            <CalendarSpot />
            <span>
              <span className="kicker">Daily and practice</span>
              Fresh Ink Every Midnight
            </span>
          </h3>
          <p>
            <strong>Daily:</strong> one puzzle per level each day, the same for every player. You get one attempt at
            each, and your result goes on the day's leaderboard. A new set appears at midnight UTC (5:30 am India time).
          </p>
          <p>
            <strong>Practice:</strong> a fresh random puzzle whenever you like. Scored the same way, but not ranked.
          </p>
        </article>

        <article>
          <h3>
            <PencilSpot />
            <span>
              <span className="kicker">Filling the grid</span>
              How to Wield the Pencil
            </span>
          </h3>
          <ul>
            <li>Click or tap a white box, then type. The cursor moves along the word.</li>
            <li>Click the same box again (or press Space) to switch between Across and Down.</li>
            <li>Click a clue to jump to its word. Tab goes to the next clue, Shift+Tab to the previous one.</li>
            <li>Arrow keys move around; Backspace deletes.</li>
            <li>The number in brackets after a clue is the answer's length. (4,4) means two words, written without the space.</li>
            <li>Letters stay if you refresh or come back later. The clock keeps running, though.</li>
          </ul>
        </article>

        <article>
          <h3>
            <MagnifierSpot />
            <span>
              <span className="kicker">Hints</span>
              Lifelines, Strictly Rationed
            </span>
          </h3>
          <p>
            You have {MAX_HINTS} hints per puzzle. Select the box you are stuck on and press <strong>Hint</strong>: its
            letter appears in grey italics and is locked in place. Each hint costs {HINT_PENALTY} points, so spend them
            where one letter unlocks the most.
          </p>
        </article>

        <article>
          <h3>
            <StopwatchSpot />
            <span>
              <span className="kicker">Submitting and score</span>
              Speed Pays, Dithering Doesn&apos;t
            </span>
          </h3>
          <p>
            Press <strong>Submit</strong> whenever you want to stop, even with boxes empty. It is final: there is no
            second try. You score for every word that is completely right:
          </p>
          <ul>
            {DIFFICULTIES.map((difficulty) => {
              const config = DIFFICULTY_CONFIG[difficulty];
              return (
                <li key={difficulty}>
                  <strong>{DIFFICULTY_LABEL[difficulty]}</strong>: {config.pointsPerWord} points a word, speed bonus
                  until {config.parSeconds / 60} minutes.
                </li>
              );
            })}
          </ul>
          <p>
            The speed bonus adds up to half again on top and shrinks steadily to nothing at the time shown. Hints are
            then deducted. The clock starts the moment a puzzle opens.
          </p>
        </article>

        <article>
          <h3>
            <TickSpot />
            <span>
              <span className="kicker">After you finish</span>
              The Reckoning: Answers Revealed
            </span>
          </h3>
          <p>
            The full solution is shown. Under each clue you see the answer: a tick if you had it, your wrong entry
            struck out beside the right one, or “not answered”. Letters you missed are printed in red in the grid.
          </p>
          <p>
            <strong>Give up</strong> shows the same answers but scores nothing and keeps you off the leaderboard.
          </p>
        </article>

        <article>
          <h3>
            <TrophySpot />
            <span>
              <span className="kicker">Leaderboard</span>
              Who&apos;s Top of the Class?
            </span>
          </h3>
          <p>
            Each day's leaderboard ranks players per level by score; on equal scores the faster time wins. Your
            nickname is all that is shown.
          </p>
        </article>
      </div>
    </section>
  );
}
