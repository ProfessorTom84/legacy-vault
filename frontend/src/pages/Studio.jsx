import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { Button, Field, MetaFields, useCategories } from '../components';

const EMPTY_META = { title: '', description: '', notes: '', category_id: '', tags: '', pinned: false, is_private: false };

/* ---------------- rich text editor (module scope, zero deps) ---------------- */

const RTE_ACTIONS = [
  { cmd: 'bold', label: 'B', style: { fontWeight: 700 } },
  { cmd: 'italic', label: 'I', style: { fontStyle: 'italic' } },
  { cmd: 'underline', label: 'U', style: { textDecoration: 'underline' } },
  { cmd: 'formatBlock', arg: 'h2', label: 'H2' },
  { cmd: 'formatBlock', arg: 'h3', label: 'H3' },
  { cmd: 'formatBlock', arg: 'blockquote', label: '❝' },
  { cmd: 'insertUnorderedList', label: '• List' },
  { cmd: 'insertOrderedList', label: '1. List' },
  { cmd: 'removeFormat', label: 'Clear' },
];

function RichTextEditor({ initialHtml, onChange }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && initialHtml !== undefined) {
      ref.current.innerHTML = initialHtml || '';
    }
    // Only on mount / when a different document is loaded in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialHtml]);

  const exec = (cmd, arg) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    onChange(ref.current?.innerHTML || '');
  };

  return (
    <div>
      <div className="rte-toolbar" role="toolbar" aria-label="Formatting">
        {RTE_ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            className="rte-btn"
            style={{ ...a.style, width: 'auto', padding: '0 9px' }}
            onMouseDown={(e) => e.preventDefault() /* keep selection */}
            onClick={() => exec(a.cmd, a.arg)}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        className="rte-area"
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML || '')}
        aria-label="Letter body"
      />
    </div>
  );
}

/* ---------------- recorder (module scope) ---------------- */

function Recorder({ kind, onRecorded }) {
  const [status, setStatus] = useState('idle'); // idle | live | recording | done | error
  const [error, setError] = useState('');
  const [blobUrl, setBlobUrl] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  // Cleanup: stop hardware and revoke any blob URL created with
  // URL.createObjectURL — leaking these holds recordings in memory.
  useEffect(() => {
    return () => {
      stopStream();
      clearInterval(timerRef.current);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const start = async () => {
    setError('');
    try {
      const constraints = kind === 'video' ? { video: { facingMode: 'user' }, audio: true } : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current && kind === 'video') {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setStatus('live');
    } catch {
      setError('Camera/microphone access was blocked. Allow it in your browser settings and try again.');
      setStatus('error');
    }
  };

  const record = () => {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mimeCandidates = kind === 'video'
      ? ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4']
      : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    const mimeType = mimeCandidates.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = rec;
    rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || (kind === 'video' ? 'video/webm' : 'audio/webm') });
      const url = URL.createObjectURL(blob);
      setBlobUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
      const ext = (rec.mimeType || '').includes('mp4') ? 'mp4' : 'webm';
      onRecorded(new File([blob], `recording-${Date.now()}.${ext}`, { type: blob.type }));
      stopStream();
      setStatus('done');
      clearInterval(timerRef.current);
    };
    rec.start();
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    setStatus('recording');
  };

  const stop = () => recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop();

  const reset = () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(null);
    onRecorded(null);
    setStatus('idle');
    setElapsed(0);
  };

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div style={{ marginBottom: 18 }}>
      {error && <div className="form-error">{error}</div>}
      {kind === 'video' && status !== 'done' && (
        <div className="record-stage" style={{ marginBottom: 12 }}>
          {status === 'idle' || status === 'error'
            ? <span style={{ color: 'var(--faint)' }}>Camera preview appears here</span>
            : <video ref={videoRef} muted playsInline />}
        </div>
      )}
      {status === 'done' && blobUrl && (
        kind === 'video'
          ? <div className="record-stage" style={{ marginBottom: 12 }}><video src={blobUrl} controls playsInline /></div>
          : <audio src={blobUrl} controls style={{ width: '100%', marginBottom: 12 }} />
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {(status === 'idle' || status === 'error') && (
          <Button type="button" variant="ghost" onClick={start}>
            {kind === 'video' ? '🎥 Open camera' : '🎙️ Open microphone'}
          </Button>
        )}
        {status === 'live' && <Button type="button" onClick={record}>● Start recording</Button>}
        {status === 'recording' && (
          <>
            <Button type="button" variant="danger" onClick={stop}>■ Stop</Button>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>
              <span className="rec-dot" /> {mm}:{ss}
            </span>
          </>
        )}
        {status === 'done' && <Button type="button" variant="ghost" onClick={reset}>Record again</Button>}
      </div>
    </div>
  );
}

/* ---------------- studio page ---------------- */

const TABS = [
  { key: 'video', label: '🎬 Video' },
  { key: 'audio', label: '🎙️ Voice note' },
  { key: 'text', label: '✉️ Letter / document' },
  { key: 'file', label: '📎 File' },
];

export default function Studio() {
  const { id } = useParams(); // present in edit mode
  const navigate = useNavigate();
  const categories = useCategories();

  const [tab, setTab] = useState('video');
  const [mode, setMode] = useState('upload'); // upload | record (video/audio)
  const [meta, setMeta] = useState(EMPTY_META);
  const [file, setFile] = useState(null);
  const [recorded, setRecorded] = useState(null);
  const [body, setBody] = useState('');
  const [initialBody, setInitialBody] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Edit mode: load the item and prefill.
  useEffect(() => {
    if (!id) {
      setEditingItem(null);
      setMeta(EMPTY_META);
      setBody('');
      setInitialBody('');
      return;
    }
    api.get(`/content/${id}`).then((d) => {
      const c = d.content;
      setEditingItem(c);
      setTab(c.type);
      setMeta({
        title: c.title,
        description: c.description,
        notes: c.notes,
        category_id: c.category_id ? String(c.category_id) : '',
        tags: c.tags.join(', '),
        pinned: c.pinned,
        is_private: c.is_private,
      });
      setBody(c.body || '');
      setInitialBody(c.body || '');
    }).catch((err) => setError(err.message));
  }, [id]);

  const tagsArray = meta.tags.split(',').map((t) => t.trim()).filter(Boolean);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (!meta.title.trim() && tab === 'text') return setError('Give it a title.');
    setBusy(true);
    try {
      if (editingItem) {
        await api.put(`/content/${editingItem.id}`, {
          ...meta,
          category_id: meta.category_id || null,
          tags: tagsArray,
          body: editingItem.type === 'text' ? body : undefined,
        });
        navigate(`/content/${editingItem.id}`);
        return;
      }

      let result;
      if (tab === 'text') {
        result = await api.post('/content/text', {
          ...meta,
          category_id: meta.category_id || null,
          tags: tagsArray,
          body,
        });
      } else {
        const chosen = mode === 'record' ? recorded : file;
        if (!chosen) {
          setError(mode === 'record' ? 'Record something first.' : 'Choose a file first.');
          setBusy(false);
          return;
        }
        const fd = new FormData();
        fd.append('file', chosen);
        fd.append('title', meta.title);
        fd.append('description', meta.description);
        fd.append('notes', meta.notes);
        if (meta.category_id) fd.append('category_id', meta.category_id);
        fd.append('tags', JSON.stringify(tagsArray));
        // FormData turns booleans into the strings 'true'/'false';
        // the backend compares with === 'true'.
        fd.append('pinned', meta.pinned);
        fd.append('is_private', meta.is_private);
        result = await api.upload(`/content/upload/${tab}`, fd);
      }
      navigate(`/content/${result.content.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const accepts = { video: 'video/*', audio: 'audio/*', file: undefined };
  const canRecord = tab === 'video' || tab === 'audio';

  return (
    <form onSubmit={save} style={{ maxWidth: 720 }}>
      <h1 className="page-title">{editingItem ? `Edit “${editingItem.title}”` : 'Add to the vault'}</h1>
      <p className="page-sub">
        {editingItem
          ? 'Update the details. The media file itself stays as it is.'
          : 'Record it now or upload it — then file it where your family will look for it.'}
      </p>

      {error && <div className="form-error">{error}</div>}

      {!editingItem && (
        <>
          <div className="chip-row">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`chip${tab === t.key ? ' on' : ''}`}
                onClick={() => { setTab(t.key); setFile(null); setRecorded(null); setMode('upload'); }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {canRecord && (
            <div style={{ marginBottom: 18 }}>
              <span className="seg" role="group" aria-label="Source">
                <button type="button" className={mode === 'upload' ? 'on' : ''} onClick={() => setMode('upload')}>Upload</button>
                <button type="button" className={mode === 'record' ? 'on' : ''} onClick={() => setMode('record')}>Record now</button>
              </span>
            </div>
          )}

          {tab !== 'text' && mode === 'upload' && (
            <Field label={tab === 'file' ? 'File (PDF, image, anything)' : `${tab === 'video' ? 'Video' : 'Audio'} file`}>
              <input
                className="input"
                type="file"
                accept={accepts[tab]}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </Field>
          )}

          {canRecord && mode === 'record' && (
            <Recorder key={tab} kind={tab} onRecorded={setRecorded} />
          )}
        </>
      )}

      <MetaFields meta={meta} setMeta={setMeta} categories={categories} />

      {(tab === 'text' || editingItem?.type === 'text') && (
        <Field label="Letter body">
          <RichTextEditor initialHtml={initialBody} onChange={setBody} />
        </Field>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <Button type="submit" loading={busy}>
          {editingItem ? 'Save changes' : 'Add to the vault'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
      </div>
    </form>
  );
}
