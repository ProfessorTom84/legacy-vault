import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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

/**
 * In-browser recording requires three things, and each is missing on some
 * real device/URL combination, so all three are checked up front:
 *   1. A secure context — browsers disable camera/mic entirely on plain
 *      http:// addresses (anything that isn't https:// or localhost).
 *   2. navigator.mediaDevices.getUserMedia — absent on very old browsers.
 *   3. window.MediaRecorder — absent on some older iOS versions.
 * When any of them is missing, the UI explains which one and offers the
 * native-camera fallback, which works everywhere including plain http.
 */
function recordingSupport() {
  if (!window.isSecureContext) return 'insecure';
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return 'nodevices';
  if (!window.MediaRecorder) return 'norecorder';
  return 'ok';
}

// Chrome/Firefox/Edge pick WebM; Safari (macOS and every iPhone browser)
// doesn't support WebM recording and picks an MP4 variant instead.
const MIME_CANDIDATES = {
  video: [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=h264,aac',
    'video/mp4',
  ],
  audio: [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
  ],
};

function pickMime(kind) {
  return MIME_CANDIDATES[kind].find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

function extensionFor(mime, kind) {
  if ((mime || '').includes('mp4')) return kind === 'audio' ? 'm4a' : 'mp4';
  if ((mime || '').includes('ogg')) return 'ogg';
  return 'webm';
}

/** Human explanation for every way getUserMedia can fail. */
function explainGetUserMediaError(err, kind) {
  const device = kind === 'video' ? 'camera' : 'microphone';
  switch (err && err.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return `Access to the ${device} was denied. Click the ${device} icon in the address bar (or your browser's site settings) to allow it, then try again.`;
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return `No ${device} was found on this device. You can upload a file instead, or use the "record with your ${kind === 'video' ? 'camera' : 'voice'} app" option below.`;
    case 'NotReadableError':
    case 'TrackStartError':
      return `The ${device} is busy — another app (FaceTime, Zoom, Teams…) may be using it. Close other apps that use the ${device} and try again.`;
    default:
      return `Could not start the ${device}${err && err.message ? ` (${err.message})` : ''}. You can upload a file instead.`;
  }
}

/**
 * Fallback that works on every device and even on plain http: a file input
 * with `capture` opens the phone's native camera/voice recorder directly on
 * iOS and Android, and a normal file picker on desktop.
 */
function NativeCaptureButton({ kind, onPicked }) {
  const inputRef = useRef(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={kind === 'video' ? 'video/*' : 'audio/*'}
        capture="user"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files && e.target.files[0];
          if (f) onPicked(f);
          e.target.value = ''; // allow re-picking the same file
        }}
      />
      <Button type="button" variant="ghost" onClick={() => inputRef.current && inputRef.current.click()}>
        {kind === 'video' ? '📱 Record with your camera app' : '📱 Record with your voice app'}
      </Button>
      <span style={{ color: 'var(--faint)', fontSize: 12 }}>
        Opens the camera on phones; on a computer it’s a file picker.
      </span>
    </>
  );
}

function Recorder({ kind, onRecorded }) {
  const support = recordingSupport(); // evaluated per render; constant per page load
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

  // Attach the live stream to the <video> only after React has actually
  // rendered it. Attaching inside start() raced the render — the element
  // didn't exist yet, so the preview stayed black even though recording
  // (which reads the stream directly) worked fine.
  useEffect(() => {
    if ((status === 'live' || status === 'recording') && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [status]);

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
    const wantVideo = kind === 'video';
    // Try the front camera first; if the exact constraint is the problem
    // (some webcams/laptops), retry with the loosest possible ask.
    const attempts = wantVideo
      ? [{ video: { facingMode: 'user' }, audio: true }, { video: true, audio: true }]
      : [{ audio: true }];
    let stream = null;
    let lastErr = null;
    for (const constraints of attempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (err) {
        lastErr = err;
        if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) break; // no point retrying a denial
      }
    }
    if (!stream) {
      setError(explainGetUserMediaError(lastErr, kind));
      setStatus('error');
      return;
    }
    streamRef.current = stream;
    setStatus('live'); // the effect above attaches the preview post-render
  };

  const record = () => {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mimeType = pickMime(kind);
    let rec;
    try {
      rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      // Last resort: let the browser choose everything.
      try {
        rec = new MediaRecorder(stream);
      } catch (err2) {
        setError(`Recording is not supported by this browser (${err2.message}). Use the option below to record with your device's own app, then it uploads here.`);
        setStatus('error');
        stopStream();
        return;
      }
    }
    recorderRef.current = rec;
    rec.ondataavailable = (e) => e.data && e.data.size > 0 && chunksRef.current.push(e.data);
    rec.onerror = (e) => {
      setError(`Recording failed${e.error ? `: ${e.error.message}` : ''}. Try again, or record with your device's own app below.`);
      setStatus('error');
      stopStream();
      clearInterval(timerRef.current);
    };
    rec.onstop = () => {
      const type = rec.mimeType || mimeType || (kind === 'video' ? 'video/mp4' : 'audio/mp4');
      const blob = new Blob(chunksRef.current, { type });
      if (blob.size === 0) {
        setError('The recording came out empty — this can happen on some browsers. Try again, or record with your device’s own app below.');
        setStatus('error');
        stopStream();
        return;
      }
      const url = URL.createObjectURL(blob);
      setBlobUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
      onRecorded(new File([blob], `recording-${Date.now()}.${extensionFor(type, kind)}`, { type }));
      stopStream();
      setStatus('done');
      clearInterval(timerRef.current);
    };
    // A 1s timeslice makes Safari deliver data during recording instead of
    // holding everything until stop — long recordings are much safer.
    rec.start(1000);
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
    setError('');
  };

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  /* ---- unsupported environments get an explanation, not a dead button ---- */
  if (support !== 'ok') {
    const httpsUrl = `https://${window.location.hostname}:8443${window.location.pathname}`;
    const messages = {
      insecure: (
        <>
          Recording needs the vault’s secure address.{' '}
          <a href={httpsUrl}><strong>Open the secure vault →</strong></a>{' '}
          (first visit shows a one-time certificate prompt — choose Advanced → Proceed).
        </>
      ),
      nodevices: <>This browser doesn’t support camera/microphone access. You can still record with your device’s own app below, or upload a file.</>,
      norecorder: <>This browser can show the camera but can’t record from it (older iOS versions, some webviews). Use the button below to record with your device’s own app — it uploads here just the same.</>,
    };
    return (
      <div style={{ marginBottom: 18 }}>
        <div className="form-hint" style={{ marginBottom: 12 }}>{messages[support]}</div>
        {blobUrl && (kind === 'video'
          ? <div className="record-stage" style={{ marginBottom: 12 }}><video src={blobUrl} controls playsInline /></div>
          : <audio src={blobUrl} controls style={{ width: '100%', marginBottom: 12 }} />)}
        <NativeCaptureButton
          kind={kind}
          onPicked={(f) => {
            const url = URL.createObjectURL(f);
            setBlobUrl((old) => { if (old) URL.revokeObjectURL(old); return url; });
            onRecorded(f);
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 18 }}>
      {error && <div className="form-error">{error}</div>}
      {kind === 'video' && status !== 'done' && (
        <div className="record-stage" style={{ marginBottom: 12 }}>
          {status === 'idle' || status === 'error'
            ? <span style={{ color: 'var(--faint)' }}>Camera preview appears here</span>
            : <video ref={videoRef} muted playsInline autoPlay />}
        </div>
      )}
      {status === 'done' && blobUrl && (
        kind === 'video'
          ? <div className="record-stage" style={{ marginBottom: 12 }}><video src={blobUrl} controls playsInline /></div>
          : <audio src={blobUrl} controls style={{ width: '100%', marginBottom: 12 }} />
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {(status === 'idle' || status === 'error') && (
          <>
            <Button type="button" variant="ghost" onClick={start}>
              {kind === 'video' ? '🎥 Open camera' : '🎙️ Open microphone'}
            </Button>
            <NativeCaptureButton
              kind={kind}
              onPicked={(f) => {
                const url = URL.createObjectURL(f);
                setBlobUrl((old) => { if (old) URL.revokeObjectURL(old); return url; });
                onRecorded(f);
                setStatus('done');
              }}
            />
          </>
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // Arriving from a question: /studio?prompt=12&type=video&title=...
  const promptId = searchParams.get('prompt');
  const promptTitle = searchParams.get('title') || '';
  const promptType = ['video', 'audio', 'text'].includes(searchParams.get('type'))
    ? searchParams.get('type')
    : null;
  const categories = useCategories();

  const [tab, setTab] = useState(promptType || 'video');
  // Recording is the vault's headline act — it opens first for video/audio.
  const [mode, setMode] = useState('record'); // record | upload
  const [meta, setMeta] = useState(promptTitle ? { ...EMPTY_META, title: promptTitle } : EMPTY_META);
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
          prompt_id: promptId || undefined,
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
        if (promptId) fd.append('prompt_id', promptId);
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

      {!editingItem && promptTitle && (
        <div className="answering-banner">
          Answering: <strong>{promptTitle}</strong>
          <span> — the question is set as the title; change it if you like.</span>
        </div>
      )}

      {!editingItem && (
        <>
          <div className="chip-row">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`chip${tab === t.key ? ' on' : ''}`}
                onClick={() => {
                  setTab(t.key);
                  setFile(null);
                  setRecorded(null);
                  setMode(t.key === 'video' || t.key === 'audio' ? 'record' : 'upload');
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {canRecord && (
            <div style={{ marginBottom: 18 }}>
              <span className="seg" role="group" aria-label="Source">
                <button type="button" className={mode === 'record' ? 'on' : ''} onClick={() => setMode('record')}>🔴 Record now</button>
                <button type="button" className={mode === 'upload' ? 'on' : ''} onClick={() => setMode('upload')}>Upload a file</button>
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

      {!editingItem && tab !== 'text' && (file || recorded) && (
        <div className="take-attached">
          ✓ {(mode === 'record' ? recorded : file)?.name || 'Media'} attached — fill in the details and publish.
        </div>
      )}

      <div className="form-section-title">Details — help them find it</div>
      <MetaFields meta={meta} setMeta={setMeta} categories={categories} />

      {(tab === 'text' || editingItem?.type === 'text') && (
        <Field label="Letter body">
          <RichTextEditor initialHtml={initialBody} onChange={setBody} />
        </Field>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <Button type="submit" loading={busy}>
          {editingItem ? 'Save changes' : 'Publish to the vault'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
      </div>
    </form>
  );
}
