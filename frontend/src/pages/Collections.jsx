import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, mediaUrl, formatDuration } from '../api';
import { useAuth } from '../auth';
import { Button, EmptyState, Field, Modal, Spinner, TypeBadge, TYPE_META } from '../components';

/* ---------------- list page ---------------- */

export function Collections() {
  const { isAuthor, user, isAdmin } = useAuth();
  const [collections, setCollections] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const load = () => api.get('/collections').then((d) => setCollections(d.collections)).catch(() => setCollections([]));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const d = await api.post('/collections', form);
      navigate(`/collections/${d.collection.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (!collections) return <Spinner />;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Collections</h1>
          <p className="page-sub">Curated sequences — go through them in order, like chapters.</p>
        </div>
        {isAuthor && (
          <span style={{ marginLeft: 'auto' }}>
            <Button onClick={() => setCreating(true)}>New collection</Button>
          </span>
        )}
      </div>

      {collections.length === 0 ? (
        <EmptyState icon="📚" title="No collections yet">
          {isAuthor ? 'Create one to group items into an ordered walkthrough — “Everything about the house”, for example.' : 'Nothing here yet.'}
        </EmptyState>
      ) : (
        <div className="grid">
          {collections.map((c) => (
            <Link key={c.id} to={`/collections/${c.id}`} className="card">
              <div className="card-media">
                {c.cover_thumbnail && c.cover_content_id ? (
                  <img src={mediaUrl(c.cover_content_id, 'thumb')} alt="" loading="lazy" />
                ) : (
                  <div className="placeholder">📚</div>
                )}
              </div>
              <div className="card-body">
                <div className="card-title">{c.title}</div>
                {c.description && <div style={{ color: 'var(--muted)', fontSize: 13 }}>{c.description}</div>}
                <div className="card-meta">
                  {c.item_count} item{c.item_count === 1 ? '' : 's'}
                  {c.author_name ? ` · by ${c.author_name}` : ''}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {creating && (
        <Modal title="New collection" onClose={() => setCreating(false)}>
          <form onSubmit={create}>
            {error && <div className="form-error">{error}</div>}
            <Field label="Title">
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Everything about the house" required autoFocus />
            </Field>
            <Field label="Description">
              <textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Button type="submit" loading={busy}>Create collection</Button>
          </form>
        </Modal>
      )}
    </>
  );
}

/* ---------------- detail page ---------------- */

function OrderedItem({ item, index }) {
  const meta = TYPE_META[item.type] || TYPE_META.file;
  return (
    <Link to={`/content/${item.id}`} className="list-row">
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--faint)', width: 26, textAlign: 'center' }}>
        {index + 1}
      </span>
      {item.thumbnail ? (
        <img className="list-row-thumb" src={mediaUrl(item.id, 'thumb')} alt="" loading="lazy" />
      ) : (
        <div className="list-row-thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{meta.icon}</div>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14.5 }}>{item.title}</div>
        <div style={{ color: 'var(--faint)', fontSize: 12.5 }}>
          {item.duration != null ? formatDuration(item.duration) : meta.label}
        </div>
      </div>
      <TypeBadge type={item.type} />
    </Link>
  );
}

/** Drag-to-reorder editor for collection items (native HTML5 DnD, no deps). */
function ReorderEditor({ items, allContent, onSave, onClose, saving }) {
  const [order, setOrder] = useState(items.map((i) => i.id));
  const [query, setQuery] = useState('');
  const dragIndex = useRef(null);
  const byId = new Map([...items, ...allContent].map((c) => [c.id, c]));

  const move = (from, to) => {
    setOrder((prev) => {
      const next = [...prev];
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      return next;
    });
  };

  const addable = allContent.filter(
    (c) => !order.includes(c.id) && c.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Modal title="Edit items & order" onClose={onClose}>
      <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
        {order.length === 0 && <p style={{ color: 'var(--muted)' }}>No items yet — add some below.</p>}
        {order.map((cid, i) => {
          const c = byId.get(cid);
          if (!c) return null;
          return (
            <div
              key={cid}
              className="drag-item"
              draggable
              onDragStart={() => { dragIndex.current = i; }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragIndex.current !== null && dragIndex.current !== i) {
                  move(dragIndex.current, i);
                  dragIndex.current = i;
                }
              }}
              onDragEnd={() => { dragIndex.current = null; }}
            >
              <span className="drag-handle" aria-hidden>⠿</span>
              <span style={{ flex: 1, fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {i + 1}. {c.title}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => i > 0 && move(i, i - 1)} aria-label="Move up">↑</button>
                <button className="btn btn-ghost btn-sm" onClick={() => i < order.length - 1 && move(i, i + 1)} aria-label="Move down">↓</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setOrder(order.filter((x) => x !== cid))} aria-label="Remove">✕</button>
              </div>
            </div>
          );
        })}
      </div>

      <Field label="Add items">
        <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your content…" />
      </Field>
      <div style={{ maxHeight: 200, overflowY: 'auto', display: 'grid', gap: 6, marginBottom: 20 }}>
        {addable.slice(0, 20).map((c) => (
          <button key={c.id} className="drag-item" style={{ cursor: 'pointer', textAlign: 'left', width: '100%', color: 'inherit' }} onClick={() => setOrder([...order, c.id])}>
            <span style={{ flex: 1, fontSize: 14 }}>{c.title}</span>
            <TypeBadge type={c.type} />
            <span style={{ color: 'var(--accent-strong)', fontWeight: 600, fontSize: 13 }}>+ Add</span>
          </button>
        ))}
      </div>

      <Button loading={saving} onClick={() => onSave(order)}>Save order</Button>
    </Modal>
  );
}

export function CollectionDetail() {
  const { id } = useParams();
  const { user, isAuthor, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [allContent, setAllContent] = useState([]);
  const [editing, setEditing] = useState(false);
  const [editMeta, setEditMeta] = useState(false);
  const [metaForm, setMetaForm] = useState({ title: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.get(`/collections/${id}`).then(setData).catch((err) => setError(err.message));
  useEffect(() => { setData(null); load(); /* eslint-disable-next-line */ }, [id]);

  const canManage = data && (isAdmin || (isAuthor && user && data.collection.author_id === user.id));

  const openEditor = async () => {
    const d = await api.get('/content');
    setAllContent(d.content);
    setEditing(true);
  };

  const saveOrder = async (order) => {
    setBusy(true);
    try {
      await api.put(`/collections/${id}/items`, { content_ids: order });
      setEditing(false);
      load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const saveMeta = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put(`/collections/${id}`, metaForm);
      setEditMeta(false);
      load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const removeCollection = async () => {
    if (!window.confirm('Delete this collection? The items inside stay in the library.')) return;
    try { await api.del(`/collections/${id}`); navigate('/collections'); } catch (err) { setError(err.message); }
  };

  if (error) return <div className="form-error" style={{ marginTop: 30 }}>{error}</div>;
  if (!data) return <Spinner />;

  const { collection, items } = data;
  const first = items[0];

  return (
    <>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1 className="page-title">📚 {collection.title}</h1>
          <p className="page-sub" style={{ marginBottom: 12 }}>
            {collection.description || 'A curated sequence.'}
            {collection.author_name ? ` · by ${collection.author_name}` : ''} · {items.length} item{items.length === 1 ? '' : 's'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {first && <Link to={`/content/${first.id}`}><Button>▶ Start from the beginning</Button></Link>}
          {canManage && <Button variant="ghost" onClick={openEditor}>Edit items</Button>}
          {canManage && (
            <Button variant="ghost" onClick={() => { setMetaForm({ title: collection.title, description: collection.description }); setEditMeta(true); }}>
              Rename
            </Button>
          )}
          {canManage && <Button variant="danger" onClick={removeCollection}>Delete</Button>}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState icon="📚" title="This collection is empty">
          {canManage ? 'Use “Edit items” to add content in the order it should be viewed.' : 'Nothing here yet.'}
        </EmptyState>
      ) : (
        <div className="list-rows" style={{ maxWidth: 760 }}>
          {items.map((item, i) => <OrderedItem key={item.id} item={item} index={i} />)}
        </div>
      )}

      {editing && (
        <ReorderEditor items={items} allContent={allContent} onSave={saveOrder} onClose={() => setEditing(false)} saving={busy} />
      )}
      {editMeta && (
        <Modal title="Rename collection" onClose={() => setEditMeta(false)}>
          <form onSubmit={saveMeta}>
            <Field label="Title">
              <input className="input" value={metaForm.title} onChange={(e) => setMetaForm({ ...metaForm, title: e.target.value })} required />
            </Field>
            <Field label="Description">
              <textarea className="textarea" value={metaForm.description} onChange={(e) => setMetaForm({ ...metaForm, description: e.target.value })} />
            </Field>
            <Button type="submit" loading={busy}>Save</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
