const EDITOR_EMAIL = 'haaaarssssh@gmail.com';

const mailto = (subject: string) => `mailto:${EDITOR_EMAIL}?subject=${encodeURIComponent(subject)}`;

/** Newspaper-style imprint: who makes Clueless and how to write in. */
export function Imprint() {
  return (
    <footer className="imprint">
      <div className="imprint-block">
        <h2>From the Editor's Desk</h2>
        <p>
          Clueless is set, edited and printed by <strong>Harsh</strong>, who also sweeps the newsroom. Every clue is
          written by hand, so the odd howler may slip past the proofreader.
        </p>
      </div>

      <div className="imprint-block">
        <h2>Letters to the Editor</h2>
        <p>Spotted a wrong clue? Have an idea, a complaint, or a pun too good to waste? Write in.</p>
        <p className="imprint-links">
          <a href={mailto('Clueless: a suggestion')}>Send a suggestion</a>
          <a href={mailto('Clueless: a clue needs correcting')}>Report a clue</a>
          <a href={mailto('Clueless: help needed')}>Ask for help</a>
        </p>
        <p className="muted small">
          Or write directly to <a href={`mailto:${EDITOR_EMAIL}`}>{EDITOR_EMAIL}</a>
        </p>
      </div>
    </footer>
  );
}
