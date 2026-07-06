import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { api, mediaUrl, formatDuration } from './api';
import { useAuth } from './auth';

/* All components live at module scope. Defining components inside another
   component's body makes React treat them as a new type on every render,
   remounting them (and losing focus/state) constantly. */

export const TYPE_META = {
  video: { label: 'Video', color: 'var(--type-video)', icon: '🎬' },
  audio: { label: 'Voice', color: 'var(--type-audio)', icon: '🎙️' },
  text: { label: 'Letter', color: 'var(--type-text)', icon: '✉️' },
  file: { label: 'File', color: 'var(--type-file)', icon: '📎' },
};

export function Button({ loading, disabled, variant = 'primary', className = '', children, ...rest }) {
  // While a request is in flight the button must be disabled — otherwise a
  // double-tap submits twice.
  return (
    <button
      className={`btn btn-${variant} ${className}`}
      disabled={disabled || loading === true}
      {...rest}
    >
      {loading ? 'Working…' : children}
    </button>
  );
}

export function TypeBadge({ type }) {
  const meta = TYPE_META[type] || TYPE_META.file;
  return (
    <span className="type-badge" style={{ background: meta.color }}>
      {meta.label}
    </span>
  );
}

export function Field({ label, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
    </div>
  );
}

export function Spinner() {
  return <div className="spinner" role="status" aria-label="Loading" />;
}

export function EmptyState({ icon = '🕯️', title, children }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      <h3 style={{ marginBottom: 6 }}>{title}</h3>
      <div>{children}</div>
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Netflix-style card: static thumbnail that swaps to the animated GIF
    preview on hover (videos only). */
export function ContentCard({ item }) {
  const [hover, setHover] = useState(false);
  const meta = TYPE_META[item.type] || TYPE_META.file;
  const hasThumb = !!item.thumbnail;
  const hasGif = item.type === 'video' && !!item.preview_gif;

  return (
    <Link
      to={`/content/${item.id}`}
      className="card"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
    >
      <div className="card-media">
        {hasThumb ? (
          <img
            src={hover && hasGif ? mediaUrl(item.id, 'preview') : mediaUrl(item.id, 'thumb')}
            alt=""
            loading="lazy"
          />
        ) : (
          <div className="placeholder" style={{ color: meta.color }}>{meta.icon}</div>
        )}
        {item.pinned && <span className="card-pin">📌 Pinned</span>}
        {item.duration != null && <span className="card-duration">{formatDuration(item.duration)}</span>}
      </div>
      <div className="card-body">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <TypeBadge type={item.type} />
          {item.is_private && !item.released && <span className="badge-private">Legacy</span>}
        </div>
        <div className="card-title">{item.title}</div>
        <div className="card-meta">
          {item.category_name && (
            <span>{item.category_icon} {item.category_name}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function CategoryRow({ category, items }) {
  if (!items.length) return null;
  return (
    <section className="row-section">
      <div className="row-head">
        <h2 className="row-title">
          <span className="row-dot" style={{ background: category.color }} />
          {category.icon} {category.name}
        </h2>
        <span className="row-count">{items.length}</span>
        <Link className="row-more" to={`/library?category=${category.id}`}>See all →</Link>
      </div>
      <div className="row-scroll">
        {items.map((item) => <ContentCard key={item.id} item={item} />)}
      </div>
    </section>
  );
}

/** Always-visible global search with instant, debounced results. */
export function GlobalSearch() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState(null);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const wrapRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!q.trim()) { setHits(null); return undefined; }
    const timer = setTimeout(async () => {
      try {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        const token = localStorage.getItem('lv_token');
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setHits(data.results.slice(0, 8));
          setOpen(true);
        }
      } catch {
        /* aborted or offline */
      }
    }, 220); // debounce
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    setOpen(false);
    navigate(`/library?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="search-wrap" ref={wrapRef}>
      <form onSubmit={submit}>
        <span className="search-icon" aria-hidden>🔍</span>
        <input
          className="search-input"
          type="search"
          placeholder="Search everything — “boiler”, “passwords”, “letter for Emma”…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits && setOpen(true)}
          aria-label="Search the vault"
        />
      </form>
      {open && hits && (
        <div className="search-panel">
          {hits.length === 0 && (
            <div style={{ padding: '14px 12px', color: 'var(--muted)', fontSize: 14 }}>
              Nothing matches “{q}” yet.
            </div>
          )}
          {hits.map((h) => (
            <div
              key={h.id}
              className="search-hit"
              onClick={() => { setOpen(false); setQ(''); navigate(`/content/${h.id}`); }}
            >
              {h.thumbnail ? (
                <img className="search-hit-thumb" src={mediaUrl(h.id, 'thumb')} alt="" />
              ) : (
                <div className="search-hit-thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {(TYPE_META[h.type] || TYPE_META.file).icon}
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div className="search-hit-title">{h.title}</div>
                {h.snippet && (
                  <div className="search-hit-snippet" dangerouslySetInnerHTML={{ __html: h.snippet }} />
                )}
              </div>
              <span style={{ marginLeft: 'auto' }}><TypeBadge type={h.type} /></span>
            </div>
          ))}
          {hits.length > 0 && (
            <div
              className="search-hit"
              style={{ justifyContent: 'center', color: 'var(--accent-strong)', fontWeight: 600, fontSize: 13 }}
              onClick={submit}
            >
              All results for “{q}” →
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  const { user, isAuthor, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden />
          Legacy Vault
        </Link>
        <GlobalSearch />
        <nav className="nav-links" aria-label="Main">
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Home</NavLink>
          <NavLink to="/library" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Library</NavLink>
          <NavLink to="/collections" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Collections</NavLink>
          {isAuthor && (
            <NavLink to="/studio" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>+ Add</NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Admin</NavLink>
          )}
          <button
            className="nav-link"
            style={{ border: 'none', background: 'none', cursor: 'pointer' }}
            onClick={() => { signOut(); navigate('/login'); }}
            title={user ? `Signed in as ${user.name}` : ''}
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}

/** Metadata inputs shared by every content form in the studio. */
export function MetaFields({ meta, setMeta, categories }) {
  return (
    <>
      <Field label="Title">
        <input className="input" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} placeholder="How to bleed the radiators" />
      </Field>
      <Field label="Description">
        <textarea className="textarea" value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} placeholder="What is this, and when will they need it?" />
      </Field>
      <Field label="Category">
        <select className="select" value={meta.category_id} onChange={(e) => setMeta({ ...meta, category_id: e.target.value })}>
          <option value="">— None —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Tags (comma separated)">
        <input className="input" value={meta.tags} onChange={(e) => setMeta({ ...meta, tags: e.target.value })} placeholder="house, heating, winter" />
      </Field>
      <Field label="Notes (extra context shown on the item page)">
        <textarea className="textarea" value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} placeholder="The stopcock key hangs in the garage on the left." />
      </Field>
      <div style={{ display: 'flex', gap: 22, marginBottom: 18 }}>
        <label className="check">
          <input type="checkbox" checked={meta.pinned} onChange={(e) => setMeta({ ...meta, pinned: e.target.checked })} />
          Pin to the top of the library
        </label>
        <label className="check">
          <input type="checkbox" checked={meta.is_private} onChange={(e) => setMeta({ ...meta, is_private: e.target.checked })} />
          Private / legacy (hidden until the admin releases it)
        </label>
      </div>
    </>
  );
}

export function useCategories() {
  const [categories, setCategories] = useState([]);
  useEffect(() => {
    api.get('/categories').then((d) => setCategories(d.categories)).catch(() => {});
  }, []);
  return categories;
}
