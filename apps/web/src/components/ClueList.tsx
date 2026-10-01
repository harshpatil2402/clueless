import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Category, Direction, EntryReview } from '@crossword/shared';
import { CATEGORY_LABEL } from '../format';
import type { Crossword } from '../hooks/useCrossword';

export function CategoryTag({ category }: { category: Category }) {
  // Falls back to the raw id for puzzles cached before a field was renamed.
  return <span className="tag">{CATEGORY_LABEL[category] ?? category}</span>;
}

const MAX_CLUE_SIZE = 20;
const MIN_CLUE_SIZE = 11;

interface ClueItem {
  index: number;
  number: number;
  clue: string;
  category: Category;
  length: number;
}

/** Answer line shown under a clue once the player has given up. */
function ReviewLine({ review }: { review: EntryReview }) {
  if (review.status === 'correct') return <span className="answer">✓ {review.answer}</span>;
  if (review.status === 'wrong') {
    return (
      <span className="answer missed">
        ✗ <s>{review.given}</s> → {review.answer}
      </span>
    );
  }
  return (
    <span className="answer missed">
      {review.answer} <em>not answered</em>
    </span>
  );
}

interface SectionProps {
  title: string;
  items: ClueItem[];
  crossword: Crossword;
  review?: EntryReview[] | null;
}

function Section({ title, items, crossword, review }: SectionProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const activeRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    // Scroll inside the list only; scrollIntoView would drag the whole page away from the grid on phones.
    const list = listRef.current;
    const item = activeRef.current;
    if (!list || !item) return;
    const top = item.offsetTop - list.offsetTop;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (top + item.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = top + item.offsetHeight - list.clientHeight;
    }
  }, [crossword.activeIndex]);

  return (
    <section className="clue-section">
      <h2>{title}</h2>
      <ol ref={listRef}>
        {items.map((item) => {
          const isActive = item.index === crossword.activeIndex;
          return (
            <li key={item.index} ref={isActive ? activeRef : undefined}>
              <button
                type="button"
                className={isActive ? 'clue active' : 'clue'}
                onClick={() => crossword.selectEntry(item.index)}
              >
                <span className="clue-number">{item.number}</span>
                <span className="clue-text">
                  {item.clue} <span className="clue-length">({item.length})</span>{' '}
                  <CategoryTag category={item.category} />
                  {review && <ReviewLine review={review[item.index]} />}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

interface ClueListProps {
  crossword: Crossword;
  entries: Array<Omit<ClueItem, 'index'> & { direction: Direction }>;
  /** Same order as entries; present once the player has given up. */
  review?: EntryReview[] | null;
}

export function ClueList({ crossword, entries, review }: ClueListProps) {
  const withIndex = entries.map((entry, index) => ({ ...entry, index }));
  const containerRef = useRef<HTMLDivElement>(null);

  // Pick the largest type size at which both columns show every clue without scrolling.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const fit = () => {
      const lists = [...container.querySelectorAll('ol')];
      let size = MAX_CLUE_SIZE;
      container.style.setProperty('--clue-size', `${size}px`);
      while (size > MIN_CLUE_SIZE && lists.some((list) => list.scrollHeight > list.clientHeight)) {
        size -= 0.5;
        container.style.setProperty('--clue-size', `${size}px`);
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [entries, review]);

  return (
    <div className="clues" ref={containerRef}>
      <Section title="Across" items={withIndex.filter((e) => e.direction === 'across')} crossword={crossword} review={review} />
      <Section title="Down" items={withIndex.filter((e) => e.direction === 'down')} crossword={crossword} review={review} />
    </div>
  );
}
