import React, { useEffect, useState } from 'react';
import { api, mediaUrl } from '../api';
import { studioLink } from './Questions';
import { useAuth } from '../auth';
import { Button, CategoryRow, ContentCard, EmptyState, Spinner } from '../components';
import { Link } from 'react-router-dom';

export default function Home() {
  const { user, isAuthor } = useAuth();
  const [state, setState] = useState({ loading: true, content: [], categories: [], settings: {} });
  const [question, setQuestion] = useState(null); // today's question (authors)
  const [asked, setAsked] = useState('');          // ask-a-question input (family)
  const [askDone, setAskDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get('/content'), api.get('/categories'), api.get('/settings')])
      .then(([c, cat, s]) => {
        if (!cancelled) {
          setState({ loading: false, content: c.content, categories: cat.categories, settings: s.settings });
        }
      })
      .catch(() => !cancelled && setState((prev) => ({ ...prev, loading: false })));
    return () => { cancelled = true; };
  }, []);

  if (state.loading) {
    return (
      <div>
        <div className="skeleton skeleton-hero" />
        <div className="skeleton-row">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton skeleton-card" />)}
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!isAuthor) return;
    api.get('/prompts/next').then((d) => setQuestion(d)).catch(() => {});
  }, [isAuthor]);

  const nextQuestion = () => {
    if (!question?.prompt) return;
    api.post(`/prompts/${question.prompt.id}/skip`, {})
      .then(() => api.get('/prompts/next'))
      .then((d) => setQuestion(d))
      .catch(() => {});
  };

  const askQuestion = (e) => {
    e.preventDefault();
    if (asked.trim().length < 5) return;
    api.post('/prompts', { text: asked.trim() })
      .then(() => { setAsked(''); setAskDone(true); })
      .catch(() => {});
  };

  const pinned = state.content.filter((c) => c.pinned);
  const byCategory = state.categories
    .map((cat) => ({ cat, items: state.content.filter((c) => c.category_id === cat.id) }))
    .filter((r) => r.items.length > 0);
  const uncategorised = state.content.filter((c) => !c.category_id);
  const recent = [...state.content]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 12);

  return (
    <>
      {(() => {
        const featured =
          pinned.find((i) => i.thumbnail) || state.content.find((i) => i.thumbnail);
        if (!featured) {
          return (
            <section className="hero">
              <div className="hero-eyebrow">{state.settings.welcome_title || 'For the people I love'}</div>
              <h1 className="hero-title">
                {state.settings.welcome_message ||
                  'Everything here was left for you. Search for what you need, or wander the shelves.'}
              </h1>
              {user && <p className="hero-message">Welcome back, {user.name}.</p>}
            </section>
          );
        }
        return (
          <section className="hero hero-cinema">
            <img className="hero-backdrop" src={mediaUrl(featured.id, 'thumb')} alt="" />
            <div className="hero-scrim" />
            <div className="hero-inner">
              <div className="hero-eyebrow">{state.settings.welcome_title || 'For the people I love'}</div>
              <h1 className="hero-title">{featured.title}</h1>
              {featured.description && <p className="hero-message">{featured.description}</p>}
              <div className="hero-actions">
                <Link className="btn-hero" to={`/content/${featured.id}`}>
                  {featured.type === 'video' ? '▶ Watch now' : featured.type === 'audio' ? '▶ Listen now' : 'Open'}
                </Link>
                <Link className="btn-hero ghost" to="/library">Browse everything</Link>
              </div>
            </div>
          </section>
        );
      })()}

      {isAuthor && question?.prompt && (
        <section className="qcard">
          <div className="qcard-eyebrow">
            {question.prompt.asked_by_name
              ? `${question.prompt.asked_by_name} asks`
              : `Today’s question · ${question.prompt.theme}`}
          </div>
          <div className="qcard-text">{question.prompt.text}</div>
          <div className="qcard-actions">
            <Link className="btn-hero" to={studioLink(question.prompt, 'video')}>🎥 Record</Link>
            <Link className="btn-hero ghost" to={studioLink(question.prompt, 'audio')}>🎙️ Voice</Link>
            <Link className="btn-hero ghost" to={studioLink(question.prompt, 'text')}>✍️ Write</Link>
            <button type="button" className="qcard-skip" onClick={nextQuestion}>↻ Another question</button>
          </div>
          <div className="qcard-progress">
            {question.answered} of {question.total} answered · <Link to="/questions">browse all decks</Link>
          </div>
        </section>
      )}

      {!isAuthor && (
        <section className="qcard qcard-ask">
          <div className="qcard-eyebrow">Is there a story you want told?</div>
          {askDone ? (
            <div className="qcard-text" style={{ fontSize: 19 }}>
              Sent. Your question is waiting in the studio with your name on it. ✓
            </div>
          ) : (
            <form onSubmit={askQuestion} className="qcard-ask-row">
              <input
                className="input"
                value={asked}
                onChange={(e) => setAsked(e.target.value)}
                placeholder="Ask anything — “Tell the story of the sailing trip?”"
                maxLength={500}
              />
              <Button type="submit">Ask</Button>
            </form>
          )}
        </section>
      )}

      {state.content.length === 0 && (
        <EmptyState title="The vault is empty">
          {isAuthor ? (
            <>Nothing here yet. <Link to="/studio" style={{ color: 'var(--accent-strong)' }}>Add the first item</Link> — a video, a voice note, a letter, or a document.</>
          ) : (
            'Nothing has been added yet. Check back soon.'
          )}
        </EmptyState>
      )}

      {pinned.length > 0 && (
        <section className="row-section">
          <div className="row-head">
            <h2 className="row-title"><span className="row-dot" style={{ background: 'var(--accent)' }} />📌 Start here</h2>
            <span className="row-count">{pinned.length}</span>
          </div>
          <div className="row-scroll">
            {pinned.map((item) => <ContentCard key={item.id} item={item} />)}
          </div>
        </section>
      )}

      {byCategory.map(({ cat, items }) => (
        <CategoryRow key={cat.id} category={cat} items={items} />
      ))}

      {uncategorised.length > 0 && (
        <CategoryRow category={{ id: '', name: 'Everything else', icon: '🗂️', color: 'var(--faint)' }} items={uncategorised} />
      )}

      {recent.length > 0 && (
        <section className="row-section">
          <div className="row-head">
            <h2 className="row-title"><span className="row-dot" style={{ background: 'var(--type-audio)' }} />Recently added</h2>
            <Link className="row-more" to="/library">Browse the whole library →</Link>
          </div>
          <div className="row-scroll">
            {recent.map((item) => <ContentCard key={`r-${item.id}`} item={item} />)}
          </div>
        </section>
      )}
    </>
  );
}
