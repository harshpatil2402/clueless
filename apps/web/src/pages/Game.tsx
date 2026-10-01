import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import {
  WRONG_SUBMIT_PENALTY,
  entryCells,
  type Difficulty,
  type EntryReview,
  type PuzzleResponse,
  type SubmitResponse,
} from '@crossword/shared';
import { api } from '../api';
import { CategoryTag, ClueList } from '../components/ClueList';
import { Grid } from '../components/Grid';
import { Masthead } from '../components/Masthead';
import { ResultModal } from '../components/ResultModal';
import { Timer } from '../components/Timer';
import { DIFFICULTY_LABEL } from '../format';
import { useCrossword } from '../hooks/useCrossword';
import { clearGrid } from '../storage';

export type GameTarget = { kind: 'daily'; difficulty: Difficulty } | { kind: 'puzzle'; id: string };

type Solved = Extract<SubmitResponse, { solved: true }>;

const PLACEHOLDER = ' ';

export function Game({ target }: { target: GameTarget }) {
  const [data, setData] = useState<PuzzleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const targetKey = target.kind === 'daily' ? `daily:${target.difficulty}` : `puzzle:${target.id}`;

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    const load = target.kind === 'daily' ? api.daily(target.difficulty) : api.puzzle(target.id);
    load.then(
      (response) => !cancelled && setData(response),
      (reason: Error) => !cancelled && setError(reason.message),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  if (error) {
    return (
      <main className="page">
        <Masthead />
        <p className="error">{error}</p>
        <a className="button" href="#/">
          Front page
        </a>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="page">
        <Masthead />
        <p className="muted">Setting the puzzle…</p>
      </main>
    );
  }
  return <Board key={data.puzzleId} data={data} />;
}

function Board({ data }: { data: PuzzleResponse }) {
  const { puzzle, puzzleId } = data;
  const crossword = useCrossword(puzzle, puzzleId, data.solution);
  const [result, setResult] = useState<Solved | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingGiveUp, setConfirmingGiveUp] = useState(false);
  const [review, setReview] = useState<EntryReview[] | null>(data.review);
  const [gaveUpSeconds, setGaveUpSeconds] = useState<number | null>(null);

  // Cells where the player's letter was wrong or missing when they gave up.
  const missed = useMemo(() => {
    const cells = new Set<string>();
    review?.forEach((entry, index) => {
      entryCells(puzzle.entries[index], entry.answer.length).forEach(([row, col], i) => {
        if (entry.given[i] !== entry.answer[i]) cells.add(`${row},${col}`);
      });
    });
    return cells;
  }, [review, puzzle]);
  const tally = (status: EntryReview['status']) => review?.filter((entry) => entry.status === status).length ?? 0;

  const finalSeconds =
    result?.elapsedSeconds ?? gaveUpSeconds ?? (data.attempt.finishedAt !== null ? data.attempt.elapsedSeconds : null);
  const finalScore = result?.score ?? data.attempt.score;

  // The key listener is attached once; it reads the latest handlers through this ref.
  const handlers = useRef(crossword);
  handlers.current = crossword;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const game = handlers.current;
      if (/^[a-zA-Z]$/.test(event.key)) game.typeLetter(event.key);
      else if (event.key === 'Backspace' || event.key === 'Delete') game.backspace();
      else if (event.key === 'ArrowUp') game.move(-1, 0);
      else if (event.key === 'ArrowDown') game.move(1, 0);
      else if (event.key === 'ArrowLeft') game.move(0, -1);
      else if (event.key === 'ArrowRight') game.move(0, 1);
      else if (event.key === 'Tab') game.stepEntry(event.shiftKey ? -1 : 1);
      else if (event.key === ' ') game.toggleDirection();
      else return;
      event.preventDefault();
      setMessage(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await api.submit(puzzleId, crossword.toGrid());
      if (response.solved) {
        clearGrid(puzzleId);
        crossword.showSolution(response.solution);
        setResult(response);
        setShowModal(true);
      } else {
        const entries = response.wrongEntries === 1 ? '1 entry is' : `${response.wrongEntries} entries are`;
        setMessage(`${entries} wrong. −${WRONG_SUBMIT_PENALTY} points.`);
      }
    } catch (reason) {
      setMessage((reason as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const giveUp = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await api.giveUp(puzzleId, crossword.toGrid());
      clearGrid(puzzleId);
      crossword.showSolution(response.solution);
      setReview(response.review);
      setGaveUpSeconds(response.elapsedSeconds);
    } catch (reason) {
      setMessage((reason as Error).message);
    } finally {
      setSubmitting(false);
      setConfirmingGiveUp(false);
    }
  };

  // Phones only raise their keyboard for a focused text field, so a hidden one sits behind the grid.
  // It always holds one placeholder character: deleting it is how Backspace is detected on Android,
  // where key events carry no usable key name.
  const inputRef = useRef<HTMLInputElement>(null);
  const focusInput = (event: MouseEvent<HTMLElement>) => {
    if (crossword.readOnly) return;
    if ((event.target as HTMLElement).closest('.grid, .clues')) inputRef.current?.focus({ preventScroll: true });
  };
  const onHiddenInput = (event: FormEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const typed = input.value.replace(PLACEHOLDER, '');
    if (input.value.length === 0) crossword.backspace();
    else for (const char of typed) if (/[a-zA-Z]/.test(char)) crossword.typeLetter(char);
    input.value = PLACEHOLDER;
    setMessage(null);
  };

  const { activeEntry } = crossword;
  return (
    <main className="page game">
      <Masthead
        date={data.date}
        left={
          <>
            <a href="#/">← Front page</a>
            <span>
              {data.kind === 'daily' ? 'Daily' : 'Practice'} · {DIFFICULTY_LABEL[puzzle.difficulty]}
            </span>
          </>
        }
        right={<Timer baseSeconds={data.attempt.elapsedSeconds} finalSeconds={finalSeconds} />}
      />

      <div className="game-body" onClick={focusInput}>
        <div className="board">
          <input
            ref={inputRef}
            className="hidden-input"
            defaultValue={PLACEHOLDER}
            onInput={onHiddenInput}
            aria-hidden="true"
            tabIndex={-1}
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <Grid crossword={crossword} missed={missed} />
          <div className="active-clue">
            <strong>
              {activeEntry.number} {activeEntry.direction === 'across' ? 'Across' : 'Down'}
            </strong>
            <span>
              {activeEntry.clue} <span className="clue-length">({activeEntry.length})</span>{' '}
              <CategoryTag category={activeEntry.category} />
            </span>
          </div>

          {review ? (
            <p className="solved-banner">
              <strong>You gave up.</strong> {tally('correct')} of {review.length} correct · {tally('wrong')} wrong ·{' '}
              {tally('unanswered')} not answered. Answers are beside each clue; missed letters are in red.
            </p>
          ) : crossword.readOnly ? (
            <p className="solved-banner">
              Solved — <strong>{finalScore}</strong> points
              {data.kind === 'daily' && (
                <>
                  {' · '}
                  <a href="#/leaderboard">Leaderboard</a>
                </>
              )}
            </p>
          ) : (
            <>
              {confirmingGiveUp ? (
                <div className="submit-row">
                  <span role="status">Give up? Answers shown, score 0.</span>
                  <button type="button" className="button primary" disabled={submitting} onClick={giveUp}>
                    Yes, give up
                  </button>
                  <button type="button" className="button" disabled={submitting} onClick={() => setConfirmingGiveUp(false)}>
                    Keep going
                  </button>
                </div>
              ) : (
                <div className="submit-row">
                  <button
                    type="button"
                    className="button primary"
                    disabled={!crossword.isFull || submitting}
                    onClick={submit}
                  >
                    {submitting ? 'Checking…' : 'Submit'}
                  </button>
                  <span className={message ? 'error' : 'muted'} role="status">
                    {message ?? (crossword.isFull ? 'Grid full. Ready to submit.' : 'Fill every cell to submit.')}
                  </span>
                  <button type="button" className="button give-up" onClick={() => setConfirmingGiveUp(true)}>
                    Give up
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <ClueList crossword={crossword} entries={puzzle.entries} review={review} />
      </div>

      {result && showModal && <ResultModal result={result} onClose={() => setShowModal(false)} />}
    </main>
  );
}
