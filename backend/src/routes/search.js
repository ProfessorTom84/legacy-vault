const express = require('express');
const { db } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

/**
 * Build a safe FTS5 MATCH expression: each term is quoted and given a
 * prefix wildcard, so user input can never inject FTS syntax.
 */
function buildMatch(q) {
  const terms = String(q || '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 12);
  if (terms.length === 0) return null;
  return terms.map((t) => `"${t.replace(/"/g, '')}"*`).join(' ');
}

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

router.get('/', (req, res) => {
  const match = buildMatch(req.query.q);
  const vis = visibilitySql(req.user);
  const where = [vis.sql];
  const params = [...vis.params];

  if (req.query.type) { where.push('c.type = ?'); params.push(String(req.query.type)); }
  if (req.query.category) { where.push('c.category_id = ?'); params.push(parseInt(req.query.category, 10)); }
  if (req.query.tag) {
    where.push('c.id IN (SELECT ct.content_id FROM content_tags ct JOIN tags t ON t.id = ct.tag_id WHERE t.name = ?)');
    params.push(String(req.query.tag).toLowerCase());
  }
  if (req.query.collection) {
    where.push('c.id IN (SELECT content_id FROM collection_items WHERE collection_id = ?)');
    params.push(parseInt(req.query.collection, 10));
  }
  if (req.query.pinned === 'true') where.push('c.pinned = 1');
  if (req.query.stale === 'true') where.push("c.reviewed_at < datetime('now', '-12 months')");
  // Legacy filter — visibility rules above still apply, so viewers only ever
  // see private items that have been released.
  if (req.query.private === 'true') where.push('c.is_private = 1');

  const tagsFor = db.prepare(
    'SELECT t.name FROM tags t JOIN content_tags ct ON ct.tag_id = t.id WHERE ct.content_id = ?'
  );

  let rows;
  if (match) {
    rows = db
      .prepare(
        `SELECT c.*, cat.name AS category_name, cat.icon AS category_icon,
                cat.color AS category_color, u.name AS author_name,
                bm25(content_fts) AS rank,
                snippet(content_fts, -1, '<mark>', '</mark>', '…', 18) AS snippet
         FROM content_fts
         JOIN content c ON c.id = content_fts.content_id
         LEFT JOIN categories cat ON cat.id = c.category_id
         LEFT JOIN users u ON u.id = c.author_id
         WHERE content_fts MATCH ? AND ${where.join(' AND ')}
         ORDER BY rank LIMIT 100`
      )
      .all(match, ...params);
  } else {
    rows = db
      .prepare(
        `SELECT c.*, cat.name AS category_name, cat.icon AS category_icon,
                cat.color AS category_color, u.name AS author_name, NULL AS snippet
         FROM content c
         LEFT JOIN categories cat ON cat.id = c.category_id
         LEFT JOIN users u ON u.id = c.author_id
         WHERE ${where.join(' AND ')}
         ORDER BY c.pinned DESC, c.created_at DESC LIMIT 100`
      )
      .all(...params);
  }

  res.json({
    results: rows.map((row) => ({
      ...row,
      pinned: !!row.pinned,
      is_private: !!row.is_private,
      released: !!row.released,
      tags: tagsFor.all(row.id).map((t) => t.name),
    })),
  });
});

// All tag names, for filter chips and the tag picker.
router.get('/tags', (req, res) => {
  const tags = db
    .prepare(
      `SELECT t.name, COUNT(ct.content_id) AS count FROM tags t
       LEFT JOIN content_tags ct ON ct.tag_id = t.id
       GROUP BY t.id ORDER BY count DESC, t.name`
    )
    .all();
  res.json({ tags });
});

module.exports = router;
