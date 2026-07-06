const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

const ROLES = ['admin', 'author', 'viewer'];

router.get('/', (req, res) => {
  const users = db
    .prepare('SELECT id, email, name, role, created_at FROM users ORDER BY created_at')
    .all();
  res.json({ users });
});

router.post('/', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const name = String(req.body.name || '').trim();
  const { password, role } = req.body;
  if (!email || !name) return res.status(400).json({ error: 'Name and email are required.' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Choose a valid role.' });
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'A user with that email already exists.' });
  }
  const info = db
    .prepare('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(email, name, bcrypt.hashSync(password, 12), role);
  res.json({ user: { id: info.lastInsertRowid, email, name, role } });
});

router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const name = req.body.name !== undefined ? String(req.body.name).trim() : user.name;
  const email =
    req.body.email !== undefined
      ? String(req.body.email).trim().toLowerCase()
      : user.email;
  const role = req.body.role !== undefined ? req.body.role : user.role;
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Choose a valid role.' });

  // Don't allow removing the last admin.
  if (user.role === 'admin' && role !== 'admin') {
    const admins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;
    if (admins <= 1) {
      return res.status(400).json({ error: 'There must always be at least one admin.' });
    }
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, id);
  if (existing) return res.status(409).json({ error: 'A user with that email already exists.' });

  // Validate everything before writing anything, so a bad password can't
  // leave a half-applied update.
  const wantsPasswordChange =
    typeof req.body.password === 'string' && req.body.password.length > 0;
  if (wantsPasswordChange && req.body.password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  db.prepare('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?').run(
    name, email, role, id
  );
  if (wantsPasswordChange) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
      bcrypt.hashSync(req.body.password, 12), id
    );
  }
  res.json({ user: { id, name, email, role } });
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (user.role === 'admin') {
    const admins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;
    if (admins <= 1) {
      return res.status(400).json({ error: 'There must always be at least one admin.' });
    }
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

module.exports = router;
