import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { CategoryRow, ContentCard, EmptyState, Spinner } from '../components';
import { Link } from 'react-router-dom';

export default function Home() {
  const { user, isAuthor } = useAuth();
  const [state, setState] = useState({ loading: true, content: [], categories: [], settings: {} });

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

  if (state.loading) return <Spinner />;

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
      <section className="hero">
        <div className="hero-eyebrow">{state.settings.welcome_title || 'For the people I love'}</div>
        <h1 className="hero-title">
          {state.settings.welcome_message ||
            'Everything here was left for you. Search for what you need, or wander the shelves.'}
        </h1>
        {user && <p className="hero-message">Welcome back, {user.name}.</p>}
      </section>

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
