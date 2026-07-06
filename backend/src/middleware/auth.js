const jwt = require('jsonwebtoken');
const { db } = require('../db');

const log = require('../utils/logger').child('auth');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  log.error('FATAL: JWT_SECRET is not set. In Unraid, add a Variable with Key JWT_SECRET; with compose, set it in .env.');
  process.exit(1);
}

const userById = db.prepare(
  'SELECT id, email, name, role, created_at FROM users WHERE id = ?'
);

/**
 * Authenticate via "Authorization: Bearer <token>" or, because <img> and
 * <video> tags cannot send headers, via a ?token= query parameter.
 */
function authenticate(req, res, next) {
  let token = null;
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) token = header.slice(7);
  if (!token && typeof req.query.token === 'string') token = req.query.token;
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Your session has expired. Sign in again.' });
  }

  const user = userById.get(payload.sub);
  if (!user) return res.status(404).json({ error: 'This account no longer exists.' });

  req.user = user;
  next();
}

const RANK = { viewer: 1, author: 2, admin: 3 };

/** requireRole('author') allows authors and admins; requireRole('admin') admins only. */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || RANK[req.user.role] < RANK[role]) {
      return res.status(403).json({ error: 'You do not have permission to do that.' });
    }
    next();
  };
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: '30d',
  });
}

module.exports = { authenticate, requireRole, signToken };
