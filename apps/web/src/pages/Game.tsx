import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import {
  HINT_PENALTY,
  MAX_HINTS,
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
  const crossword = useCrossword(puzzle, puzzleId, data.solution, data.hints);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<'submit' | 'giveup' | null>(null);
  const [review, setReview] = useState<EntryReview[] | null>(data.review);
  const [gaveUp, setGaveUp] = useState(data.attempt.gaveUp);
  const [endSeconds, setEndSeconds] = useState<number | null>(
    data.attempt.finishedAt !== null ? data.attempt.elapsedSeconds : null,
  );
  const [hintsUsed, setHintsUsed] = useState(data.attempt.hintsUsed);
  const hintsLeft = MAX_HINTS - hintsUsed;
  const finalScore = result?.score ?? data.attempt.score;

  // Cells where the player's letter was wrong or missing when the puzzle ended.
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

  /** Runs a server call that ends or changes the attempt, with shared busy and error handling. */
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (reason) {
      setMessage((reason as Error).message);
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const submit = () =>
    run(async () => {
      const response = await api.submit(puzzleId, crossword.toGrid());
      clearGrid(puzzleId);
      crossword.showSolution(response.solution);
      setReview(response.review);
      setEndSeconds(response.elapsedSeconds);
      setResult(response);
      setShowModal(true);
    });

  const giveUp = () =>
    run(async () => {
      const response = await api.giveUp(puzzleId, crossword.toGrid());
      clearGrid(puzzleId);
      crossword.showSolution(response.solution);
      setReview(response.review);
      setEndSeconds(response.elapsedSeconds);
      setGaveUp(true);
    });

  const useHint = () => {
    const { row, col } = crossword.cursor;
    if (crossword.locked.has(`${row},${col}`)) {
      setMessage('That letter is already revealed. Pick another box.');
      return;
    }
    return run(async () => {
      const response = await api.hint(puzzleId, row, col);
      crossword.reveal(response);
      setHintsUsed(MAX_HINTS - response.hintsLeft);
    });
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

  const { activeEntry, emptyCount } = crossword;
  const emptyText = emptyCount === 0 ? 'Grid full.' : `${emptyCount} ${emptyCount === 1 ? 'box' : 'boxes'} empty.`;

  let controls;
  if (review) {
    controls = (
      <p className="solved-banner">
        {gaveUp ? (
          <strong>You gave up.</strong>
        ) : (
          <>
            <strong>{finalScore} points.</strong>
            {data.kind === 'daily' && (
              <>
                {' '}
                <a href="#/leaderboard">Leaderboard</a>.
              </>
            )}
          </>
        )}{' '}
        {tally('correct')} of {review.length} correct · {tally('wrong')} wrong · {tally('unanswered')} not answered.
        {missed.size > 0 && ' Answers are beside each clue; missed letters are in red.'}
      </p>
    );
  } else if (crossword.readOnly) {
    // Attempts finished before reviews were stored have only a score.
    controls = (
      <p className="solved-banner">
        Solved — <strong>{finalScore}</strong> points
      </p>
    );
  } else if (confirming) {
    controls = (
      <div className="submit-row">
        <span role="status">
          {confirming === 'submit'
            ? `Final submit? ${emptyText}`
            : 'Give up? Answers shown, score 0.'}
        </span>
        <button type="button" className="button primary" disabled={busy} onClick={confirming === 'submit' ? submit : giveUp}>
          {confirming === 'submit' ? 'Yes, submit' : 'Yes, give up'}
        </button>
        <button type="button" className="button" disabled={busy} onClick={() => setConfirming(null)}>
          Keep going
        </button>
      </div>
    );
  } else {
    controls = (
      <div className="submit-row">
        <button type="button" className="button primary" disabled={busy} onClick={() => setConfirming('submit')}>
          Submit
        </button>
        <button
          type="button"
          className="button"
          disabled={busy || hintsLeft === 0}
          title={`Reveals the letter in the selected box. Costs ${HINT_PENALTY} points.`}
          onClick={useHint}
        >
          Hint · {hintsLeft} left
        </button>
        <span className={message ? 'error' : 'muted'} role="status">
          {message ?? emptyText}
        </span>
        <button type="button" className="button give-up" disabled={busy} onClick={() => setConfirming('giveup')}>
          Give up
        </button>
      </div>
    );
  }

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
        right={<Timer baseSeconds={data.attempt.elapsedSeconds} finalSeconds={endSeconds} />}
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
          {controls}
        </div>

        <ClueList crossword={crossword} entries={puzzle.entries} review={review} />
      </div>

      {result && showModal && <ResultModal result={result} onClose={() => setShowModal(false)} />}
    </main>
  );
}
