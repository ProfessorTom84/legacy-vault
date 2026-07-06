const express = require('express');
const { db } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const categories = db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM content WHERE category_id = c.id) AS item_count
       FROM categories c ORDER BY c.sort_order, c.name`
    )
    .all();
  res.json({ categories });
});

router.post('/', requireRole('admin'), (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Give the category a name.' });
  const icon = String(req.body.icon || '📁').slice(0, 8);
  const color = /^#[0-9a-fA-F]{3,8}$/.test(String(req.body.color || ''))
    ? req.body.color
    : '#c9822e';
  const parentId = req.body.parent_id ? parseInt(req.body.parent_id, 10) : null;
  const sortOrder = parseInt(req.body.sort_order, 10) || 0;
  const info = db
    .prepare('INSERT INTO categories (name, icon, color, parent_id, sort_order) VALUES (?, ?, ?, ?, ?)')
    .run(name, icon, color, parentId, sortOrder);
  res.json({ category: db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid) });
});

router.put('/:id', requireRole('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!cat) return res.status(404).json({ error: 'Category not found.' });
  const name = req.body.name !== undefined ? String(req.body.name).trim() : cat.name;
  const icon = req.body.icon !== undefined ? String(req.body.icon).slice(0, 8) : cat.icon;
  const color =
    req.body.color !== undefined && /^#[0-9a-fA-F]{3,8}$/.test(String(req.body.color))
      ? req.body.color
      : cat.color;
  let parentId = cat.parent_id;
  if (req.body.parent_id !== undefined) {
    parentId = req.body.parent_id ? parseInt(req.body.parent_id, 10) : null;
    if (parentId === id) parentId = cat.parent_id; // no self-parenting
  }
  const sortOrder =
    req.body.sort_order !== undefined ? parseInt(req.body.sort_order, 10) || 0 : cat.sort_order;
  db.prepare(
    'UPDATE categories SET name = ?, icon = ?, color = ?, parent_id = ?, sort_order = ? WHERE id = ?'
  ).run(name, icon, color, parentId, sortOrder, id);
  res.json({ category: db.prepare('SELECT * FROM categories WHERE id = ?').get(id) });
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!db.prepare('SELECT id FROM categories WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Category not found.' });
  }
  db.prepare('UPDATE categories SET parent_id = NULL WHERE parent_id = ?').run(id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.json({ ok: true });
});

module.exports = router;
