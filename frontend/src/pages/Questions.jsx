import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Button, EmptyState, Spinner } from '../components';

/* ---------------- module-scope pieces (never defined inside components) ---------------- */

const TYPE_ACTION = {
  video: { icon: '🎥', label: 'Record' },
  audio: { icon: '🎙️', label: 'Voice' },
  text: { icon: '✍️', label: 'Write' },
};

export function studioLink(prompt, type) {
  const t = type || prompt.suggested_type || 'video';
  const params = new URLSearchParams({ prompt: prompt.id, type: t, title: prompt.text });
  return `/studio?${params.toString()}`;
}

/** Small conic-gradient progress ring: answered / total. */
function ProgressRing({ answered, total }) {
  const pct = total ? Math.round((answered / total) * 100) : 0;
  return (
    <div
      className="deck-ring"
      style={{ background: `conic-gradient(var(--accent) ${pct * 3.6}deg, var(--line) 0deg)` }}
      aria-label={`${answered} of ${total} answered`}
    >
      <span>{answered}<em>/{total}</em></span>
    </div>
  );
}

function QuestionRow({ prompt }) {
  const act = TYPE_ACTION[prompt.suggested_type] || TYPE_ACTION.video;
  return (
    <div className={`question-row${prompt.status === 'answered' ? ' answered' : ''}`}>
      <div className="question-text">
        {prompt.text}
        {prompt.asked_by_name && <span className="asked-by"> — asked by {prompt.asked_by_name}</span>}
      </div>
      {prompt.status === 'answered' && prompt.content_id ? (
        <Link className="question-answered" to={`/content/${prompt.content_id}`}>✓ Answered — watch</Link>
      ) : prompt.status === 'answered' ? (
        <span className="question-answered">✓ Answered</span>
      ) : (
        <Link className="question-cta" to={studioLink(prompt)}>{act.icon} {act.label}</Link>
      )}
    </div>
  );
}

/* ---------------- page ---------------- */

export default function Questions() {
  const { isAuthor } = useAuth();
  const [params, setParams] = useSearchParams();
  const theme = params.get('theme') || '';

  const [themes, setThemes] = useState(null);
  const [deck, setDeck] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthor) return;
    api.get('/prompts/themes')
      .then((d) => setThemes(d.themes))
      .catch((e) => setError(e.message));
  }, [isAuthor]);

  useEffect(() => {
    if (!isAuthor || !theme) { setDeck(null); return; }
    setDeck(null);
    api.get(`/prompts?theme=${encodeURIComponent(theme)}`)
      .then((d) => setDeck(d.prompts))
      .catch((e) => setError(e.message));
  }, [isAuthor, theme]);

  if (!isAuthor) {
    return (
      <EmptyState title="Questions live in the Studio">
        This page is where authors answer the family’s questions. You can ask one from the home page.
      </EmptyState>
    );
  }

  /* ---- one deck ---- */
  if (theme) {
    return (
      <div style={{ maxWidth: 860 }}>
        <button className="chip" onClick={() => setParams({})} style={{ marginBottom: 18 }}>← All decks</button>
        <h1 className="page-title">{theme}</h1>
        <p className="page-sub">Answer any of these — one small story at a time is exactly how a vault gets built.</p>
        {error && <div className="form-error">{error}</div>}
        {!deck ? <Spinner /> : deck.length === 0 ? (
          <EmptyState title="Nothing here yet">
            {theme === 'From Your Family'
              ? 'When someone in the family asks you a question from their home page, it lands here with their name on it.'
              : 'This deck is empty.'}
          </EmptyState>
        ) : (
          <div className="question-list">
            {deck.map((p) => <QuestionRow key={p.id} prompt={p} />)}
          </div>
        )}
      </div>
    );
  }

  /* ---- all decks ---- */
  return (
    <div>
      <h1 className="page-title">Questions worth answering</h1>
      <p className="page-sub">
        Decks of questions to record against — stories, practical know-how, and letters for later.
        Two minutes on one question beats waiting for a free afternoon that never comes.
      </p>
      {error && <div className="form-error">{error}</div>}
      {!themes ? <Spinner /> : (
        <div className="deck-grid">
          {themes.map((t) => (
            <button key={t.theme} className="deck-card" onClick={() => setParams({ theme: t.theme })}>
              <ProgressRing answered={t.answered || 0} total={t.total} />
              <div className="deck-name">{t.theme}</div>
              <div className="deck-sub">
                {t.theme === 'From Your Family'
                  ? (t.total ? `${t.total - (t.answered || 0)} waiting for you` : 'No questions asked yet')
                  : `${t.total} questions`}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
