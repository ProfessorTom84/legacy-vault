const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const log = require('../utils/logger').child('prompts');

const router = express.Router();
router.use(requireAuth);

const ASKED_THEME = 'From Your Family';

function safeInt(v) {
  const n = Number.parseInt(v, 10);
  return Number.isInteger(n) ? n : null;
}

function serialize(p, state) {
  return {
    id: p.id,
    theme: p.asked_by ? ASKED_THEME : p.theme,
    text: p.text,
    suggested_type: p.suggested_type,
    asked_by_name: p.asked_by_name || null,
    status: state ? state.status : null,
    content_id: state ? state.content_id : null,
  };
}

/**
 * GET /api/prompts/next — today's question for this author.
 * Questions asked by family come first (someone is waiting on those),
 * then never-seen library questions, then previously skipped ones.
 */
router.get('/next', requireRole('author'), (req, res) => {
  const pick = (sql) =>
    db
      .prepare(
        `SELECT p.*, u.name AS asked_by_name FROM prompts p
         LEFT JOIN users u ON u.id = p.asked_by
         ${sql} ORDER BY RANDOM() LIMIT 1`
      )
      .get(req.user.id);

  const unseen = `WHERE p.id NOT IN (SELECT prompt_id FROM prompt_state WHERE user_id = ?)`;
  const prompt =
    pick(`${unseen} AND p.asked_by IS NOT NULL`) || // family questions first
    pick(`${unseen} AND p.asked_by IS NULL`) ||
    pick(`WHERE p.id IN (SELECT prompt_id FROM prompt_state WHERE user_id = ? AND status = 'skipped')`);

  const totals = db
    .prepare(
      `SELECT COUNT(*) AS total,
              (SELECT COUNT(*) FROM prompt_state WHERE user_id = ? AND status = 'answered') AS answered
       FROM prompts`
    )
    .get(req.user.id);

  res.json({ prompt: prompt ? serialize(prompt) : null, ...totals });
});

/** GET /api/prompts/themes — the decks, with this author's progress. */
router.get('/themes', requireRole('author'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT CASE WHEN p.asked_by IS NULL THEN p.theme ELSE ? END AS theme,
              MIN(p.sort_order) AS first_sort,
              COUNT(*) AS total,
              SUM(CASE WHEN ps.status = 'answered' THEN 1 ELSE 0 END) AS answered
       FROM prompts p
       LEFT JOIN prompt_state ps ON ps.prompt_id = p.id AND ps.user_id = ?
       GROUP BY 1
       ORDER BY (theme = ?) DESC, first_sort`
    )
    .all(ASKED_THEME, req.user.id, ASKED_THEME);
  res.json({ themes: rows.map(({ theme, total, answered }) => ({ theme, total, answered })) });
});

/** GET /api/prompts?theme=X — one deck's questions with my status. */
router.get('/', requireRole('author'), (req, res) => {
  const theme = String(req.query.theme || '');
  const askedDeck = theme === ASKED_THEME;
  const rows = db
    .prepare(
      `SELECT p.*, u.name AS asked_by_name, ps.status, ps.content_id
       FROM prompts p
       LEFT JOIN users u ON u.id = p.asked_by
       LEFT JOIN prompt_state ps ON ps.prompt_id = p.id AND ps.user_id = ?
       WHERE ${askedDeck ? 'p.asked_by IS NOT NULL' : 'p.asked_by IS NULL AND p.theme = ?'}
       ORDER BY p.sort_order, p.id`
    )
    .all(...(askedDeck ? [req.user.id] : [req.user.id, theme]));
  res.json({ prompts: rows.map((r) => serialize(r, r)) });
});

/**
 * POST /api/prompts — ask a question. Any signed-in family member can do
 * this; it lands in the authors' "From Your Family" deck with their name on it.
 */
router.post('/', (req, res) => {
  const text = String(req.body.text || '').trim();
  if (text.length < 5) return res.status(400).json({ error: 'Write out the question first.' });
  if (text.length > 500) return res.status(400).json({ error: 'Keep the question under 500 characters.' });
  const suggested = ['video', 'audio', 'text'].includes(req.body.suggested_type)
    ? req.body.suggested_type
    : 'video';
  const info = db
    .prepare('INSERT INTO prompts (theme, text, suggested_type, asked_by) VALUES (?, ?, ?, ?)')
    .run(ASKED_THEME, text, suggested, req.user.id);
  log.info('question asked', { by: req.user.id, prompt: info.lastInsertRowid });
  res.status(201).json({ id: info.lastInsertRowid });
});

/** POST /api/prompts/:id/skip — not today; resurfaces after unseen ones run out. */
router.post('/:id/skip', requireRole('author'), (req, res) => {
  const id = safeInt(req.params.id);
  const prompt = id === null ? null : db.prepare('SELECT id FROM prompts WHERE id = ?').get(id);
  if (!prompt) return res.status(404).json({ error: 'Question not found.' });
  db.prepare(
    `INSERT INTO prompt_state (user_id, prompt_id, status, updated_at)
     VALUES (?, ?, 'skipped', datetime('now'))
     ON CONFLICT (user_id, prompt_id)
     DO UPDATE SET status = 'skipped', updated_at = datetime('now')`
  ).run(req.user.id, id);
  res.json({ ok: true });
});

/**
 * Mark a prompt answered, linking the content that answers it.
 * Called from the content routes after a successful publish.
 */
function markAnswered(userId, promptId, contentId) {
  const id = safeInt(promptId);
  if (id === null) return;
  if (!db.prepare('SELECT id FROM prompts WHERE id = ?').get(id)) return;
  db.prepare(
    `INSERT INTO prompt_state (user_id, prompt_id, status, content_id, updated_at)
     VALUES (?, ?, 'answered', ?, datetime('now'))
     ON CONFLICT (user_id, prompt_id)
     DO UPDATE SET status = 'answered', content_id = excluded.content_id, updated_at = datetime('now')`
  ).run(userId, id, contentId);
  log.info('question answered', { user: userId, prompt: id, content: contentId });
}

module.exports = { router, markAnswered };
