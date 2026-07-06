const express = require('express');
const path = require('path');
const fs = require('fs');
const { db, DIRS, syncFts, removeFts, setTags } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { uploadVideo, uploadAudio, uploadFile, handleUpload } = require('../middleware/upload');
const media = require('../services/media');

const router = express.Router();
router.use(authenticate);

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

// FormData sends booleans as the strings 'true'/'false'; JSON sends real
// booleans. Never use a truthy check — 'false' is truthy.
function parseBool(v) {
  return v === true || v === 'true' ? 1 : 0;
}

// Route ids and numeric filters arrive as strings; anything non-numeric
// must 404/skip cleanly instead of reaching the database as NaN.
function safeInt(v) {
  const n = Number.parseInt(v, 10);
  return Number.isInteger(n) ? n : null;
}

function parseTags(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (err) {
      /* fall through to comma splitting */
    }
    return raw.split(',');
  }
  return [];
}

// Very small rich-text sanitiser: drop script/style blocks, on* handlers
// and javascript: URLs.
function sanitizeHtml(html) {
  return String(html || '')
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
}

/**
 * Visibility: viewers see public items and private items that have been
 * released; authors additionally see their own private items; admins see all.
 */
function visibilitySql(user, alias = 'c') {
  if (user.role === 'admin') return { sql: '1=1', params: [] };
  if (user.role === 'author') {
    return {
      sql: `(${alias}.is_private = 0 OR ${alias}.released = 1 OR ${alias}.author_id = ?)`,
      params: [user.id],
    };
  }
  return { sql: `(${alias}.is_private = 0 OR ${alias}.released = 1)`, params: [] };
}

const BASE_SELECT = `
  SELECT c.*, cat.name AS category_name, cat.icon AS category_icon,
         cat.color AS category_color, u.name AS author_name
  FROM content c
  LEFT JOIN categories cat ON cat.id = c.category_id
  LEFT JOIN users u ON u.id = c.author_id
`;

const tagsFor = db.prepare(
  'SELECT t.name FROM tags t JOIN content_tags ct ON ct.tag_id = t.id WHERE ct.content_id = ? ORDER BY t.name'
);

function serialize(row) {
  if (!row) return null;
  return {
    ...row,
    pinned: !!row.pinned,
    is_private: !!row.is_private,
    released: !!row.released,
    tags: tagsFor.all(row.id).map((t) => t.name),
  };
}

function canEdit(user, row) {
  return user.role === 'admin' || (user.role === 'author' && row.author_id === user.id);
}

function applyCommonMeta(id, body) {
  setTags(id, parseTags(body.tags));
  syncFts(id);
}

/** Background thumbnail/preview generation after an upload returns. */
function generateVideoAssets(contentId, filePath, baseName) {
  media
    .probeDuration(filePath)
    .then((duration) => {
      db.prepare('UPDATE content SET duration = ? WHERE id = ?').run(duration, contentId);
      return Promise.all([
        media.videoThumbnail(filePath, baseName, duration),
        media.videoPreviewGif(filePath, baseName, duration),
      ]).catch((err) => {
        console.error(`[media] asset generation failed for content ${contentId}:`, err.message);
        return [null, null];
      });
    })
    .then((result) => {
      if (!result) return;
      const [thumb, gif] = result;
      db.prepare('UPDATE content SET thumbnail = COALESCE(?, thumbnail), preview_gif = COALESCE(?, preview_gif) WHERE id = ?')
        .run(thumb, gif, contentId);
    })
    .catch((err) => console.error(`[media] probe failed for content ${contentId}:`, err.message));
}

function generateAudioAssets(contentId, filePath, baseName) {
  Promise.all([media.probeDuration(filePath), media.audioWaveform(filePath, baseName)])
    .then(([duration, wave]) => {
      db.prepare('UPDATE content SET duration = ?, thumbnail = ? WHERE id = ?').run(
        duration, wave, contentId
      );
    })
    .catch((err) =>
      console.error(`[media] audio assets failed for content ${contentId}:`, err.message)
    );
}

function insertContent(fields) {
  const info = db
    .prepare(
      `INSERT INTO content
        (type, title, description, body, notes, filename, original_name, mime_type,
         size, category_id, author_id, pinned, is_private)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      fields.type, fields.title, fields.description, fields.body, fields.notes,
      fields.filename, fields.original_name, fields.mime_type, fields.size,
      fields.category_id, fields.author_id, fields.pinned, fields.is_private
    );
  return info.lastInsertRowid;
}

function commonFields(req, type, file) {
  const title = String(req.body.title || '').trim();
  return {
    type,
    title,
    description: String(req.body.description || ''),
    body: type === 'text' ? sanitizeHtml(req.body.body) : '',
    notes: String(req.body.notes || ''),
    filename: file ? file.filename : null,
    original_name: file ? file.originalname : null,
    mime_type: file ? file.mimetype : null,
    size: file ? file.size : null,
    category_id: req.body.category_id ? parseInt(req.body.category_id, 10) : null,
    author_id: req.user.id,
    pinned: parseBool(req.body.pinned),
    is_private: parseBool(req.body.is_private),
  };
}

/* ------------------------------------------------------------------ *
 * SPECIFIC ROUTES FIRST. Express matches in registration order, so
 * /text, /upload/video etc. must come before the /:id wildcard or a
 * POST to /upload/video would be routed to the wrong handler.
 * ------------------------------------------------------------------ */

router.post('/text', requireRole('author'), (req, res) => {
  const fields = commonFields(req, 'text', null);
  if (!fields.title) return res.status(400).json({ error: 'Give it a title.' });
  const id = insertContent(fields);
  applyCommonMeta(id, req.body);
  res.json({ content: serialize(db.prepare(`${BASE_SELECT} WHERE c.id = ?`).get(id)) });
});

router.post(
  '/upload/video',
  requireRole('author'),
  handleUpload(uploadVideo, 'file'),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Attach a video file.' });
    const fields = commonFields(req, 'video', req.file);
    if (!fields.title) fields.title = path.parse(req.file.originalname).name;
    const id = insertContent(fields);
    applyCommonMeta(id, req.body);
    generateVideoAssets(id, req.file.path, path.parse(req.file.filename).name);
    res.json({ content: serialize(db.prepare(`${BASE_SELECT} WHERE c.id = ?`).get(id)) });
  }
);

router.post(
  '/upload/audio',
  requireRole('author'),
  handleUpload(uploadAudio, 'file'),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Attach an audio file.' });
    const fields = commonFields(req, 'audio', req.file);
    if (!fields.title) fields.title = path.parse(req.file.originalname).name;
    const id = insertContent(fields);
    applyCommonMeta(id, req.body);
    generateAudioAssets(id, req.file.path, path.parse(req.file.filename).name);
    res.json({ content: serialize(db.prepare(`${BASE_SELECT} WHERE c.id = ?`).get(id)) });
  }
);

router.post(
  '/upload/file',
  requireRole('author'),
  handleUpload(uploadFile, 'file'),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Attach a file.' });
    const fields = commonFields(req, 'file', req.file);
    if (!fields.title) fields.title = path.parse(req.file.originalname).name;
    const id = insertContent(fields);
    applyCommonMeta(id, req.body);
    res.json({ content: serialize(db.prepare(`${BASE_SELECT} WHERE c.id = ?`).get(id)) });
  }
);

/* ------------------------------------------------------------------ *
 * List
 * ------------------------------------------------------------------ */

router.get('/', (req, res) => {
  const vis = visibilitySql(req.user);
  const where = [vis.sql];
  const params = [...vis.params];

  if (req.query.type) {
    where.push('c.type = ?');
    params.push(String(req.query.type));
  }
  if (safeInt(req.query.category) !== null) {
    where.push('c.category_id = ?');
    params.push(safeInt(req.query.category));
  }
  if (req.query.tag) {
    where.push(
      'c.id IN (SELECT ct.content_id FROM content_tags ct JOIN tags t ON t.id = ct.tag_id WHERE t.name = ?)'
    );
    params.push(String(req.query.tag).toLowerCase());
  }
  if (safeInt(req.query.collection) !== null) {
    where.push('c.id IN (SELECT content_id FROM collection_items WHERE collection_id = ?)');
    params.push(safeInt(req.query.collection));
  }
  if (req.query.pinned === 'true') where.push('c.pinned = 1');
  if (req.query.stale === 'true') where.push("c.reviewed_at < datetime('now', '-12 months')");
  if (req.query.private === 'true') where.push('c.is_private = 1');

  const rows = db
    .prepare(`${BASE_SELECT} WHERE ${where.join(' AND ')} ORDER BY c.pinned DESC, c.created_at DESC LIMIT 500`)
    .all(...params);
  res.json({ content: rows.map(serialize) });
});

/* ------------------------------------------------------------------ *
 * Wildcard /:id routes — registered after everything specific.
 * ------------------------------------------------------------------ */

function loadVisible(req, res) {
  const id = safeInt(req.params.id);
  if (id === null) {
    res.status(404).json({ error: 'That item does not exist.' });
    return null;
  }
  const row = db.prepare(`${BASE_SELECT} WHERE c.id = ?`).get(id);
  if (!row) {
    res.status(404).json({ error: 'That item does not exist.' });
    return null;
  }
  const visible =
    req.user.role === 'admin' ||
    !row.is_private ||
    row.released ||
    (req.user.role === 'author' && row.author_id === req.user.id);
  if (!visible) {
    res.status(404).json({ error: 'That item does not exist.' });
    return null;
  }
  return row;
}

router.get('/:id', (req, res) => {
  const row = loadVisible(req, res);
  if (!row) return;

  const vis = visibilitySql(req.user);

  // Related: same category or sharing a tag, visible to this user.
  const related = db
    .prepare(
      `${BASE_SELECT}
       WHERE c.id != ? AND ${vis.sql} AND (
         (c.category_id IS NOT NULL AND c.category_id = ?)
         OR c.id IN (
           SELECT ct2.content_id FROM content_tags ct1
           JOIN content_tags ct2 ON ct2.tag_id = ct1.tag_id
           WHERE ct1.content_id = ?
         )
       )
       ORDER BY c.created_at DESC LIMIT 8`
    )
    .all(row.id, ...vis.params, row.category_id, row.id)
    .map(serialize);

  // Collections containing this item, with prev/next neighbours.
  const memberships = db
    .prepare(
      `SELECT col.id, col.title, ci.position
       FROM collection_items ci JOIN collections col ON col.id = ci.collection_id
       WHERE ci.content_id = ? ORDER BY col.title`
    )
    .all(row.id);

  function findNeighbour(collectionId, position, direction) {
    const op = direction === 'next' ? '>' : '<';
    const ord = direction === 'next' ? 'ASC' : 'DESC';
    return db
      .prepare(
        `SELECT c.id, c.title, c.type
         FROM collection_items ci JOIN content c ON c.id = ci.content_id
         WHERE ci.collection_id = ? AND ci.position ${op} ? AND ${vis.sql}
         ORDER BY ci.position ${ord} LIMIT 1`
      )
      .get(collectionId, position, ...vis.params) || null;
  }

  const collections = memberships.map((m) => ({
    id: m.id,
    title: m.title,
    position: m.position,
    prev: findNeighbour(m.id, m.position, 'prev'),
    next: findNeighbour(m.id, m.position, 'next'),
  }));

  res.json({ content: serialize(row), related, collections });
});

router.post('/:id/reviewed', requireRole('author'), (req, res) => {
  const row = loadVisible(req, res);
  if (!row) return;
  if (!canEdit(req.user, row)) {
    return res.status(403).json({ error: 'You can only review your own content.' });
  }
  db.prepare("UPDATE content SET reviewed_at = datetime('now') WHERE id = ?").run(row.id);
  res.json({ ok: true });
});

router.post('/:id/release', requireRole('admin'), (req, res) => {
  const id = safeInt(req.params.id);
  const row = id === null ? null : db.prepare('SELECT * FROM content WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'That item does not exist.' });
  const released = parseBool(req.body.released);
  db.prepare('UPDATE content SET released = ? WHERE id = ?').run(released, id);
  res.json({ ok: true, released: !!released });
});

router.put('/:id', requireRole('author'), (req, res) => {
  const row = loadVisible(req, res);
  if (!row) return;
  if (!canEdit(req.user, row)) {
    return res.status(403).json({ error: 'You can only edit your own content.' });
  }

  const title =
    req.body.title !== undefined ? String(req.body.title).trim() : row.title;
  if (!title) return res.status(400).json({ error: 'Give it a title.' });
  const description =
    req.body.description !== undefined ? String(req.body.description) : row.description;
  const notes = req.body.notes !== undefined ? String(req.body.notes) : row.notes;
  const body =
    row.type === 'text' && req.body.body !== undefined
      ? sanitizeHtml(req.body.body)
      : row.body;
  const categoryId =
    req.body.category_id !== undefined
      ? safeInt(req.body.category_id)
      : row.category_id;
  const pinned = req.body.pinned !== undefined ? parseBool(req.body.pinned) : row.pinned;
  const isPrivate =
    req.body.is_private !== undefined ? parseBool(req.body.is_private) : row.is_private;
  // Turning an item private again re-hides it until the admin releases it.
  const released = isPrivate && !row.is_private ? 0 : row.released;

  db.prepare(
    `UPDATE content SET title = ?, description = ?, notes = ?, body = ?, category_id = ?,
       pinned = ?, is_private = ?, released = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(title, description, notes, body, categoryId, pinned, isPrivate, released, row.id);

  if (req.body.tags !== undefined) setTags(row.id, parseTags(req.body.tags));
  syncFts(row.id);

  res.json({ content: serialize(db.prepare(`${BASE_SELECT} WHERE c.id = ?`).get(row.id)) });
});

router.delete('/:id', requireRole('author'), (req, res) => {
  const row = loadVisible(req, res);
  if (!row) return;
  if (!canEdit(req.user, row)) {
    return res.status(403).json({ error: 'You can only delete your own content.' });
  }

  // Remove files from disk (best effort).
  const dirByType = { video: DIRS.videos, audio: DIRS.audio, file: DIRS.files };
  const targets = [];
  if (row.filename && dirByType[row.type]) targets.push(path.join(dirByType[row.type], row.filename));
  if (row.thumbnail) targets.push(path.join(DIRS.thumbs, row.thumbnail));
  if (row.preview_gif) targets.push(path.join(DIRS.previews, row.preview_gif));
  for (const t of targets) {
    fs.promises.unlink(t).catch(() => {});
  }

  db.prepare('DELETE FROM content WHERE id = ?').run(row.id);
  removeFts(row.id);
  res.json({ ok: true });
});

module.exports = router;
