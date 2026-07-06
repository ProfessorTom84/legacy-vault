import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate } from '../api';
import { Button, Field, Modal, Spinner, TypeBadge } from '../components';

const ROLES = ['viewer', 'author', 'admin'];
const ROLE_HELP = {
  viewer: 'Browse, search and watch only',
  author: 'Can also upload, record and edit content',
  admin: 'Full control, including users and settings',
};

/* ---------------- users ---------------- */

function UserForm({ initial, onSubmit, busy, error }) {
  const [form, setForm] = useState(
    initial
      ? { name: initial.name, email: initial.email, role: initial.role, password: '' }
      : { name: '', email: '', role: 'viewer', password: '' }
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
      {error && <div className="form-error">{error}</div>}
      <Field label="Name">
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
      <Field label="Email">
        <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
      </Field>
      <Field label="Role">
        <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <span style={{ color: 'var(--faint)', fontSize: 12.5 }}>{ROLE_HELP[form.role]}</span>
      </Field>
      <Field label={initial ? 'New password (leave blank to keep current)' : 'Password (8+ characters)'}>
        <input className="input" type="password" minLength={form.password ? 8 : undefined} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!initial} />
      </Field>
      <Button type="submit" loading={busy}>{initial ? 'Save user' : 'Add user'}</Button>
    </form>
  );
}

function UsersPanel() {
  const [users, setUsers] = useState(null);
  const [modal, setModal] = useState(null); // 'new' | user object
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.get('/users').then((d) => setUsers(d.users)).catch(() => setUsers([]));
  useEffect(() => { load(); }, []);

  const submit = async (form) => {
    setBusy(true);
    setError('');
    try {
      if (modal === 'new') await api.post('/users', form);
      else await api.put(`/users/${modal.id}`, form);
      setModal(null);
      load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const remove = async (u) => {
    if (!window.confirm(`Remove ${u.name}? They will no longer be able to sign in.`)) return;
    try { await api.del(`/users/${u.id}`); load(); } catch (err) { window.alert(err.message); }
  };

  if (!users) return <Spinner />;
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ color: 'var(--muted)', margin: 0 }}>Add as many viewers and authors as you like.</p>
        <Button onClick={() => { setError(''); setModal('new'); }}>Add user</Button>
      </div>
      <table className="table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th /></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td style={{ fontWeight: 600 }}>{u.name}</td>
              <td style={{ color: 'var(--muted)' }}>{u.email}</td>
              <td><span className="tag-chip">{u.role}</span></td>
              <td style={{ color: 'var(--faint)' }}>{formatDate(u.created_at)}</td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => { setError(''); setModal(u); }}>Edit</button>{' '}
                <button className="btn btn-danger btn-sm" onClick={() => remove(u)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {modal && (
        <Modal title={modal === 'new' ? 'Add user' : `Edit ${modal.name}`} onClose={() => setModal(null)}>
          <UserForm initial={modal === 'new' ? null : modal} onSubmit={submit} busy={busy} error={error} />
        </Modal>
      )}
    </>
  );
}

/* ---------------- categories ---------------- */

function CategoryForm({ initial, categories, onSubmit, busy, error }) {
  const [form, setForm] = useState(
    initial
      ? { name: initial.name, icon: initial.icon, color: initial.color, parent_id: initial.parent_id || '' }
      : { name: '', icon: '📁', color: '#d99a4e', parent_id: '' }
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
      {error && <div className="form-error">{error}</div>}
      <Field label="Name">
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="House & Car" required />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="Icon (emoji)">
          <input className="input" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
        </Field>
        <Field label="Colour">
          <input className="input" type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} style={{ height: 42, padding: 4 }} />
        </Field>
      </div>
      <Field label="Parent category (optional)">
        <select className="select" value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}>
          <option value="">— Top level —</option>
          {categories.filter((c) => !initial || c.id !== initial.id).map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
      </Field>
      <Button type="submit" loading={busy}>{initial ? 'Save category' : 'Add category'}</Button>
    </form>
  );
}

function CategoriesPanel() {
  const [categories, setCategories] = useState(null);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.get('/categories').then((d) => setCategories(d.categories)).catch(() => setCategories([]));
  useEffect(() => { load(); }, []);

  const submit = async (form) => {
    setBusy(true);
    setError('');
    try {
      const payload = { ...form, parent_id: form.parent_id || null };
      if (modal === 'new') await api.post('/categories', payload);
      else await api.put(`/categories/${modal.id}`, payload);
      setModal(null);
      load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete “${c.name}”? Items inside keep existing but lose this category.`)) return;
    try { await api.del(`/categories/${c.id}`); load(); } catch (err) { window.alert(err.message); }
  };

  if (!categories) return <Spinner />;
  const byParent = (pid) => categories.filter((c) => (c.parent_id || null) === pid);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ color: 'var(--muted)', margin: 0 }}>These become the shelves on the homepage.</p>
        <Button onClick={() => { setError(''); setModal('new'); }}>Add category</Button>
      </div>
      <div className="list-rows">
        {byParent(null).map((c) => (
          <React.Fragment key={c.id}>
            <div className="list-row">
              <span className="row-dot" style={{ background: c.color }} />
              <span style={{ fontSize: 18 }}>{c.icon}</span>
              <span style={{ fontWeight: 600, flex: 1 }}>{c.name}</span>
              <span style={{ color: 'var(--faint)', fontSize: 13 }}>{c.item_count} items</span>
              <button className="btn btn-ghost btn-sm" onClick={() => { setError(''); setModal(c); }}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => remove(c)}>Delete</button>
            </div>
            {byParent(c.id).map((sub) => (
              <div className="list-row" key={sub.id} style={{ marginLeft: 34 }}>
                <span className="row-dot" style={{ background: sub.color }} />
                <span style={{ fontSize: 18 }}>{sub.icon}</span>
                <span style={{ fontWeight: 600, flex: 1 }}>{sub.name}</span>
                <span style={{ color: 'var(--faint)', fontSize: 13 }}>{sub.item_count} items</span>
                <button className="btn btn-ghost btn-sm" onClick={() => { setError(''); setModal(sub); }}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(sub)}>Delete</button>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
      {modal && (
        <Modal title={modal === 'new' ? 'Add category' : `Edit ${modal.name}`} onClose={() => setModal(null)}>
          <CategoryForm initial={modal === 'new' ? null : modal} categories={categories} onSubmit={submit} busy={busy} error={error} />
        </Modal>
      )}
    </>
  );
}

/* ---------------- homepage settings ---------------- */

function SettingsPanel() {
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/settings').then((d) => setForm({
      welcome_title: d.settings.welcome_title || '',
      welcome_message: d.settings.welcome_message || '',
    })).catch(() => setForm({ welcome_title: '', welcome_message: '' }));
  }, []);

  if (!form) return <Spinner />;

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    try {
      await api.put('/settings', form);
      setSaved(true);
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={save} style={{ maxWidth: 560 }}>
      {saved && <div className="form-ok">Saved. The homepage hero now shows this.</div>}
      <Field label="Featured banner eyebrow">
        <input className="input" value={form.welcome_title} onChange={(e) => setForm({ ...form, welcome_title: e.target.value })} placeholder="For the people I love" />
      </Field>
      <Field label="Welcome message">
        <textarea className="textarea" style={{ minHeight: 130 }} value={form.welcome_message} onChange={(e) => setForm({ ...form, welcome_message: e.target.value })} />
      </Field>
      <Button type="submit" loading={busy}>Save homepage</Button>
    </form>
  );
}

/* ---------------- private / legacy content ---------------- */

function PrivatePanel() {
  const [items, setItems] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = () => api.get('/content?private=true').then((d) => setItems(d.content)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);

  const toggle = async (item) => {
    setBusyId(item.id);
    try { await api.post(`/content/${item.id}/release`, { released: !item.released }); load(); } finally { setBusyId(null); }
  };

  if (!items) return <Spinner />;
  if (items.length === 0) {
    return <p style={{ color: 'var(--muted)' }}>No private / legacy items. Authors can mark content as legacy when adding it; it stays hidden from viewers until you release it here.</p>;
  }
  return (
    <div className="list-rows">
      {items.map((item) => (
        <div className="list-row" key={item.id}>
          <TypeBadge type={item.type} />
          <Link to={`/content/${item.id}`} style={{ fontWeight: 600, flex: 1 }}>{item.title}</Link>
          {item.released ? <span className="badge-released">Released</span> : <span className="badge-private">Hidden</span>}
          <Button variant="ghost" className="btn-sm" loading={busyId === item.id} onClick={() => toggle(item)}>
            {item.released ? 'Hide again' : 'Release to viewers'}
          </Button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- page ---------------- */

const PANELS = [
  { key: 'users', label: 'Users', el: <UsersPanel /> },
  { key: 'categories', label: 'Categories', el: <CategoriesPanel /> },
  { key: 'home', label: 'Homepage', el: <SettingsPanel /> },
  { key: 'legacy', label: 'Legacy content', el: <PrivatePanel /> },
];

export default function Admin() {
  const [panel, setPanel] = useState('users');
  return (
    <>
      <h1 className="page-title">Admin</h1>
      <p className="page-sub">Users, categories, and what the vault says when someone arrives.</p>
      <div className="chip-row">
        {PANELS.map((p) => (
          <button key={p.key} className={`chip${panel === p.key ? ' on' : ''}`} onClick={() => setPanel(p.key)}>{p.label}</button>
        ))}
      </div>
      {PANELS.find((p) => p.key === panel)?.el}
    </>
  );
}
