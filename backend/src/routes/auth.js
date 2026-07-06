const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { authenticate, signToken } = require('../middleware/auth');
const { sendResetEmail } = require('../services/mailer');

const router = express.Router();

const countUsers = db.prepare('SELECT COUNT(*) AS n FROM users');
const userByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const createUser = db.prepare(
  'INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)'
);

function validPassword(pw) {
  return typeof pw === 'string' && pw.length >= 8;
}
function normEmail(e) {
  return String(e || '').trim().toLowerCase();
}

// Does the instance still need first-run setup?
router.get('/status', (req, res) => {
  res.json({ needsSetup: countUsers.get().n === 0 });
});

// First-run setup: creates the admin account only. Rejected once any user exists.
router.post('/setup', (req, res) => {
  if (countUsers.get().n > 0) {
    return res.status(403).json({ error: 'Setup has already been completed.' });
  }
  const email = normEmail(req.body.email);
  const name = String(req.body.name || '').trim();
  const { password } = req.body;
  if (!email || !name) return res.status(400).json({ error: 'Name and email are required.' });
  if (!validPassword(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  const hash = bcrypt.hashSync(password, 12);
  const info = createUser.run(email, name, hash, 'admin');
  const user = { id: info.lastInsertRowid, email, name, role: 'admin' };
  res.json({ token: signToken(user), user });
});

router.post('/login', (req, res) => {
  const email = normEmail(req.body.email);
  const user = userByEmail.get(email);
  if (!user || !bcrypt.compareSync(String(req.body.password || ''), user.password_hash)) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  res.json({
    token: signToken(user),
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

// Returns 404 (via authenticate) if the account behind the token was deleted.
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

router.post('/change-password', authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!validPassword(newPassword)) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(String(currentPassword || ''), user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
    bcrypt.hashSync(newPassword, 12),
    req.user.id
  );
  res.json({ ok: true });
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const email = normEmail(req.body.email);
    const user = userByEmail.get(email);
    // Always answer the same way so addresses can't be enumerated.
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      db.prepare('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?').run(
        token,
        Date.now() + 60 * 60 * 1000,
        user.id
      );
      await sendResetEmail(email, token).catch((err) =>
        console.error('[mailer] failed to send reset email:', err.message)
      );
    }
    res.json({ ok: true, message: 'If that account exists, a reset link is on its way.' });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', (req, res) => {
  const { token, password } = req.body;
  if (!validPassword(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  const user = db
    .prepare('SELECT * FROM users WHERE reset_token = ? AND reset_expires > ?')
    .get(String(token || ''), Date.now());
  if (!user) {
    return res.status(400).json({ error: 'That reset link is invalid or has expired.' });
  }
  db.prepare(
    'UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?'
  ).run(bcrypt.hashSync(password, 12), user.id);
  res.json({ ok: true });
});

module.exports = router;
