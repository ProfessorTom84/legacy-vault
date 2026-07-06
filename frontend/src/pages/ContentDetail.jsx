import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, mediaUrl, formatDate, formatDuration, formatSize } from '../api';
import { useAuth } from '../auth';
import { Button, ContentCard, Spinner, TypeBadge, TYPE_META } from '../components';

function Player({ item }) {
  if (item.type === 'video') {
    return (
      <div className="player-frame">
        <video controls playsInline preload="metadata" poster={item.thumbnail ? mediaUrl(item.id, 'thumb') : undefined} src={mediaUrl(item.id, 'file')} />
      </div>
    );
  }
  if (item.type === 'audio') {
    return (
      <div className="audio-frame">
        {item.thumbnail && <img src={mediaUrl(item.id, 'thumb')} alt="Waveform" />}
        <audio controls preload="metadata" src={mediaUrl(item.id, 'file')} />
      </div>
    );
  }
  if (item.type === 'text') {
    return (
      <div className="doc-frame">
        <div className="doc-body" dangerouslySetInnerHTML={{ __html: item.body }} />
      </div>
    );
  }
  // file
  const isImage = (item.mime_type || '').startsWith('image/');
  const isPdf = item.mime_type === 'application/pdf';
  return (
    <div className="doc-frame" style={{ textAlign: isImage || isPdf ? 'initial' : 'center' }}>
      {isImage && <img src={mediaUrl(item.id, 'file')} alt={item.title} style={{ borderRadius: 8, margin: '0 auto' }} />}
      {isPdf && (
        <iframe title={item.title} src={mediaUrl(item.id, 'file')} style={{ width: '100%', height: '70vh', border: 'none', borderRadius: 8 }} />
      )}
      {!isImage && !isPdf && (
        <div style={{ padding: '30px 0', color: 'var(--muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📎</div>
          {item.original_name} · {formatSize(item.size)}
        </div>
      )}
      <div style={{ marginTop: 18, textAlign: 'center' }}>
        <a href={mediaUrl(item.id, 'file', '&download=true')} download>
          <Button variant="ghost">Download {item.original_name || 'file'}</Button>
        </a>
      </div>
    </div>
  );
}

export default function ContentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthor, isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.get(`/content/${id}`)
      .then(setData)
      .catch((err) => setError(err.message));
  };
  useEffect(() => {
    setData(null);
    setError('');
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <div className="form-error" style={{ marginTop: 30 }}>{error}</div>;
  if (!data) return <Spinner />;

  const { content: item, related, collections } = data;
  const canEdit = isAdmin || (isAuthor && user && item.author_id === user.id);
  const meta = TYPE_META[item.type] || TYPE_META.file;

  const markReviewed = async () => {
    setBusy(true);
    try { await api.post(`/content/${item.id}/reviewed`); load(); } catch { /* noop */ } finally { setBusy(false); }
  };
  const toggleRelease = async () => {
    setBusy(true);
    try { await api.post(`/content/${item.id}/release`, { released: !item.released }); load(); } catch { /* noop */ } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm('Delete this item permanently? This cannot be undone.')) return;
    setBusy(true);
    try { await api.del(`/content/${item.id}`); navigate('/library'); } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="detail-layout">
      <div>
        <Player item={item} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
          <TypeBadge type={item.type} />
          {item.pinned && <span className="tag-chip">📌 Pinned</span>}
          {item.is_private && (item.released
            ? <span className="badge-released">Released</span>
            : <span className="badge-private">Legacy — hidden from viewers</span>)}
        </div>
        <h1 className="page-title" style={{ marginTop: 10 }}>{item.title}</h1>
        <p style={{ color: 'var(--muted)', margin: '2px 0 0' }}>
          {item.author_name ? `Left by ${item.author_name}` : meta.label} · {formatDate(item.created_at)}
          {item.duration != null ? ` · ${formatDuration(item.duration)}` : ''}
        </p>

        {item.description && <p style={{ marginTop: 16, maxWidth: '68ch' }}>{item.description}</p>}

        {item.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            {item.tags.map((t) => (
              <Link key={t} to={`/library?tag=${encodeURIComponent(t)}`} className="tag-chip">#{t}</Link>
            ))}
          </div>
        )}

        {item.notes && (
          <div className="notes-box">
            <div className="label">A note from {item.author_name || 'the author'}</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{item.notes}</div>
          </div>
        )}

        {(canEdit || isAdmin) && (
          <div style={{ display: 'flex', gap: 10, marginTop: 26, flexWrap: 'wrap' }}>
            {canEdit && <Link to={`/studio/edit/${item.id}`}><Button variant="ghost">Edit</Button></Link>}
            {canEdit && (
              <Button variant="ghost" loading={busy} onClick={markReviewed} title={`Last reviewed ${formatDate(item.reviewed_at)}`}>
                Mark as reviewed
              </Button>
            )}
            {isAdmin && item.is_private && (
              <Button variant="ghost" loading={busy} onClick={toggleRelease}>
                {item.released ? 'Hide from viewers again' : 'Release to viewers'}
              </Button>
            )}
            {canEdit && <Button variant="danger" loading={busy} onClick={remove}>Delete</Button>}
          </div>
        )}
      </div>

      <aside>
        {collections.length > 0 && (
          <div className="sidebar-block">
            <h3 className="sidebar-title">Part of</h3>
            {collections.map((c) => (
              <div key={c.id}>
                <div className="coll-nav">
                  <Link to={`/collections/${c.id}`} style={{ fontWeight: 600, fontSize: 14 }}>
                    📚 {c.title}
                  </Link>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  {c.prev ? (
                    <Link to={`/content/${c.prev.id}`} style={{ flex: 1 }}>
                      <Button variant="ghost" className="btn-sm" style={{ width: '100%' }}>← {c.prev.title.slice(0, 18)}{c.prev.title.length > 18 ? '…' : ''}</Button>
                    </Link>
                  ) : <span style={{ flex: 1 }} />}
                  {c.next ? (
                    <Link to={`/content/${c.next.id}`} style={{ flex: 1 }}>
                      <Button variant="ghost" className="btn-sm" style={{ width: '100%' }}>{c.next.title.slice(0, 18)}{c.next.title.length > 18 ? '…' : ''} →</Button>
                    </Link>
                  ) : <span style={{ flex: 1 }} />}
                </div>
              </div>
            ))}
          </div>
        )}

        {related.length > 0 && (
          <div className="sidebar-block">
            <h3 className="sidebar-title">Related</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              {related.map((r) => <ContentCard key={r.id} item={r} />)}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
