import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, mediaUrl, formatDuration, formatDate } from '../api';
import { useAuth } from '../auth';
import { ContentCard, EmptyState, Spinner, TypeBadge, TYPE_META, useCategories } from '../components';

const TYPES = ['video', 'audio', 'text', 'file'];

function ListRow({ item }) {
  const meta = TYPE_META[item.type] || TYPE_META.file;
  return (
    <Link to={`/content/${item.id}`} className="list-row">
      {item.thumbnail ? (
        <img className="list-row-thumb" src={mediaUrl(item.id, 'thumb')} alt="" loading="lazy" />
      ) : (
        <div className="list-row-thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
          {meta.icon}
        </div>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14.5 }}>{item.title}</div>
        <div style={{ color: 'var(--faint)', fontSize: 12.5 }}>
          {item.category_name ? `${item.category_icon} ${item.category_name} · ` : ''}
          {formatDate(item.created_at)}
          {item.duration != null ? ` · ${formatDuration(item.duration)}` : ''}
        </div>
        {item.snippet && (
          <div className="search-hit-snippet" dangerouslySetInnerHTML={{ __html: item.snippet }} />
        )}
      </div>
      <TypeBadge type={item.type} />
    </Link>
  );
}

export default function Library() {
  const [params, setParams] = useSearchParams();
  const { isAuthor } = useAuth();
  const categories = useCategories();
  const [tags, setTags] = useState([]);
  const [results, setResults] = useState(null);
  const [view, setView] = useState('grid');

  const q = params.get('q') || '';
  const type = params.get('type') || '';
  const category = params.get('category') || '';
  const tag = params.get('tag') || '';
  const pinned = params.get('pinned') === 'true';
  const stale = params.get('stale') === 'true';
  const legacy = params.get('private') === 'true';

  useEffect(() => {
    api.get('/search/tags').then((d) => setTags(d.tags.slice(0, 24))).catch(() => {});
  }, []);

  // Debounced fetch whenever the query or any filter changes.
  useEffect(() => {
    const timer = setTimeout(() => {
      const qs = new URLSearchParams();
      if (q) qs.set('q', q);
      if (type) qs.set('type', type);
      if (category) qs.set('category', category);
      if (tag) qs.set('tag', tag);
      if (pinned) qs.set('pinned', 'true');
      if (stale) qs.set('stale', 'true');
      if (legacy) qs.set('private', 'true');
      api.get(`/search?${qs.toString()}`)
        .then((d) => setResults(d.results))
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [q, type, category, tag, pinned, stale, legacy]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const activeCategory = useMemo(
    () => categories.find((c) => String(c.id) === category),
    [categories, category]
  );

  return (
    <>
      <h1 className="page-title">Library</h1>
      <p className="page-sub">
        {q ? <>Results for “{q}”</> : 'Everything in the vault, in one place.'}
        {activeCategory && <> · in {activeCategory.icon} {activeCategory.name}</>}
      </p>

      <div className="chip-row" role="group" aria-label="Type filters">
        <button className={`chip${type === '' ? ' on' : ''}`} onClick={() => setParam('type', '')}>All types</button>
        {TYPES.map((t) => (
          <button key={t} className={`chip${type === t ? ' on' : ''}`} onClick={() => setParam('type', type === t ? '' : t)}>
            {TYPE_META[t].icon} {TYPE_META[t].label}
          </button>
        ))}
        <span style={{ width: 12 }} />
        <button className={`chip${pinned ? ' on' : ''}`} onClick={() => setParam('pinned', pinned ? '' : 'true')}>📌 Pinned</button>
        <button className={`chip${stale ? ' on' : ''}`} onClick={() => setParam('stale', stale ? '' : 'true')} title="Not reviewed in over 12 months">⏳ Needs review</button>
        {isAuthor && (
          <button className={`chip${legacy ? ' on' : ''}`} onClick={() => setParam('private', legacy ? '' : 'true')} title="Private items, hidden from viewers until released">🔒 Legacy</button>
        )}
        <span style={{ marginLeft: 'auto' }} className="seg" role="group" aria-label="View">
          <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')}>Grid</button>
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>List</button>
        </span>
      </div>

      <div className="chip-row" role="group" aria-label="Category filters">
        {categories.map((c) => (
          <button
            key={c.id}
            className={`chip${String(c.id) === category ? ' on' : ''}`}
            onClick={() => setParam('category', String(c.id) === category ? '' : String(c.id))}
          >
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {tags.length > 0 && (
        <div className="chip-row" role="group" aria-label="Tag filters">
          {tags.map((t) => (
            <button
              key={t.name}
              className={`chip${tag === t.name ? ' on' : ''}`}
              style={{ fontSize: 12 }}
              onClick={() => setParam('tag', tag === t.name ? '' : t.name)}
            >
              #{t.name}
            </button>
          ))}
        </div>
      )}

      {results === null ? (
        <Spinner />
      ) : results.length === 0 ? (
        <EmptyState title="Nothing found">
          Try fewer filters, or a different word — search covers titles, descriptions, letters and tags.
        </EmptyState>
      ) : view === 'grid' ? (
        <div className="grid">
          {results.map((item) => <ContentCard key={item.id} item={item} />)}
        </div>
      ) : (
        <div className="list-rows">
          {results.map((item) => <ListRow key={item.id} item={item} />)}
        </div>
      )}
    </>
  );
}
