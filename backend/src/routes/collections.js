const express = require('express');
const { db } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function visibilitySql(user) {
  if (user.role === 'admin') return { sql: '1=1', params: [] };
  if (user.role === 'author') {
    return {
      sql: '(c.is_private = 0 OR c.released = 1 OR c.author_id = ?)',
      params: [user.id],
    };
  }
  return { sql: '(c.is_private = 0 OR c.released = 1)', params: [] };
}

function loadById(req) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return { id: null, collection: null };
  return { id, collection: db.prepare('SELECT * FROM collections WHERE id = ?').get(id) };
}

function canManage(user, collection) {
  return user.role === 'admin' || (user.role === 'author' && collection.author_id === user.id);
}

router.get('/', (req, res) => {
  const vis = visibilitySql(req.user);
  const collections = db
    .prepare(
      `SELECT col.*, u.name AS author_name,
        (SELECT COUNT(*) FROM collection_items ci JOIN content c ON c.id = ci.content_id
          WHERE ci.collection_id = col.id AND ${vis.sql}) AS item_count,
        (SELECT c.thumbnail FROM collection_items ci JOIN content c ON c.id = ci.content_id
          WHERE ci.collection_id = col.id AND c.thumbnail IS NOT NULL AND ${vis.sql}
          ORDER BY ci.position LIMIT 1) AS cover_thumbnail,
        (SELECT c.id FROM collection_items ci JOIN content c ON c.id = ci.content_id
          WHERE ci.collection_id = col.id AND c.thumbnail IS NOT NULL AND ${vis.sql}
          ORDER BY ci.position LIMIT 1) AS cover_content_id
       FROM collections col LEFT JOIN users u ON u.id = col.author_id
       ORDER BY col.created_at DESC`
    )
    .all(...vis.params, ...vis.params, ...vis.params);
  res.json({ collections });
});

router.post('/', requireRole('author'), (req, res) => {
  const title = String(req.body.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Give the collection a title.' });
  const info = db
    .prepare('INSERT INTO collections (title, description, author_id) VALUES (?, ?, ?)')
    .run(title, String(req.body.description || ''), req.user.id);
  res.json({
    collection: db.prepare('SELECT * FROM collections WHERE id = ?').get(info.lastInsertRowid),
  });
});

router.get('/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const collection = Number.isInteger(id)
    ? db.prepare(
        'SELECT col.*, u.name AS author_name FROM collections col LEFT JOIN users u ON u.id = col.author_id WHERE col.id = ?'
      ).get(id)
    : null;
  if (!collection) return res.status(404).json({ error: 'Collection not found.' });

  const vis = visibilitySql(req.user);
  const tagsFor = db.prepare(
    'SELECT t.name FROM tags t JOIN content_tags ct ON ct.tag_id = t.id WHERE ct.content_id = ?'
  );
  const items = db
    .prepare(
      `SELECT c.*, ci.position, cat.name AS category_name, cat.icon AS category_icon,
              cat.color AS category_color
       FROM collection_items ci
       JOIN content c ON c.id = ci.content_id
       LEFT JOIN categories cat ON cat.id = c.category_id
       WHERE ci.collection_id = ? AND ${vis.sql}
       ORDER BY ci.position`
    )
    .all(id, ...vis.params)
    .map((row) => ({
      ...row,
      pinned: !!row.pinned,
      is_private: !!row.is_private,
      released: !!row.released,
      tags: tagsFor.all(row.id).map((t) => t.name),
    }));

  res.json({ collection, items });
});

router.put('/:id', requireRole('author'), (req, res) => {
  const { id, collection } = loadById(req);
  if (!collection) return res.status(404).json({ error: 'Collection not found.' });
  if (!canManage(req.user, collection)) {
    return res.status(403).json({ error: 'You can only edit your own collections.' });
  }
  const title =
    req.body.title !== undefined ? String(req.body.title).trim() : collection.title;
  if (!title) return res.status(400).json({ error: 'Give the collection a title.' });
  const description =
    req.body.description !== undefined
      ? String(req.body.description)
      : collection.description;
  db.prepare('UPDATE collections SET title = ?, description = ? WHERE id = ?').run(
    title, description, id
  );
  res.json({ collection: db.prepare('SELECT * FROM collections WHERE id = ?').get(id) });
});

// Replace the full ordered item list (used for add/remove/drag-reorder).
const replaceItems = db.transaction((collectionId, contentIds) => {
  db.prepare('DELETE FROM collection_items WHERE collection_id = ?').run(collectionId);
  const insert = db.prepare(
    'INSERT OR IGNORE INTO collection_items (collection_id, content_id, position) VALUES (?, ?, ?)'
  );
  contentIds.forEach((cid, i) => {
    const exists = db.prepare('SELECT id FROM content WHERE id = ?').get(cid);
    if (exists) insert.run(collectionId, cid, i);
  });
});

router.put('/:id/items', requireRole('author'), (req, res) => {
  const { id, collection } = loadById(req);
  if (!collection) return res.status(404).json({ error: 'Collection not found.' });
  if (!canManage(req.user, collection)) {
    return res.status(403).json({ error: 'You can only edit your own collections.' });
  }
  const ids = Array.isArray(req.body.content_ids)
    ? req.body.content_ids.map((n) => parseInt(n, 10)).filter(Number.isFinite)
    : null;
  if (!ids) return res.status(400).json({ error: 'content_ids must be an array.' });
  replaceItems(id, ids);
  res.json({ ok: true });
});

router.delete('/:id', requireRole('author'), (req, res) => {
  const { id, collection } = loadById(req);
  if (!collection) return res.status(404).json({ error: 'Collection not found.' });
  if (!canManage(req.user, collection)) {
    return res.status(403).json({ error: 'You can only delete your own collections.' });
  }
  db.prepare('DELETE FROM collections WHERE id = ?').run(id);
  res.json({ ok: true });
});

module.exports = router;
