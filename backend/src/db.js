const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || '/data';
const DB_DIR = path.join(DATA_DIR, 'db');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DIRS = {
  videos: path.join(UPLOAD_DIR, 'videos'),
  audio: path.join(UPLOAD_DIR, 'audio'),
  files: path.join(UPLOAD_DIR, 'files'),
  thumbs: path.join(UPLOAD_DIR, 'thumbs'),
  previews: path.join(UPLOAD_DIR, 'previews'),
};

for (const dir of [DB_DIR, UPLOAD_DIR, ...Object.values(DIRS)]) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(path.join(DB_DIR, 'vault.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','author','viewer')),
  reset_token TEXT,
  reset_expires INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '📁',
  color TEXT NOT NULL DEFAULT '#c9822e',
  parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('video','audio','text','file')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  filename TEXT,
  original_name TEXT,
  mime_type TEXT,
  size INTEGER,
  duration REAL,
  thumbnail TEXT,
  preview_gif TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  is_private INTEGER NOT NULL DEFAULT 0,
  released INTEGER NOT NULL DEFAULT 0,
  reviewed_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS content_tags (
  content_id INTEGER NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (content_id, tag_id)
);

CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS collection_items (
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  content_id INTEGER NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, content_id)
);

CREATE TABLE IF NOT EXISTS prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  theme TEXT NOT NULL,
  text TEXT NOT NULL,
  suggested_type TEXT NOT NULL DEFAULT 'video',
  sort_order INTEGER NOT NULL DEFAULT 0,
  asked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS prompt_state (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt_id INTEGER NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('answered','skipped')),
  content_id INTEGER REFERENCES content(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, prompt_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
  title, description, notes, body, tags,
  content_id UNINDEXED
);
`);

const defaultSettings = {
  welcome_title: 'For the people I love',
  welcome_message:
    'Everything here was left for you — how-to videos, letters, documents, and voice notes. Search for what you need, or wander the shelves.',
};
const insertSetting = db.prepare(
  'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
);
for (const [k, v] of Object.entries(defaultSettings)) insertSetting.run(k, v);

/** Strip HTML tags for indexing rich-text bodies. */
function stripHtml(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ');
}

const ftsDelete = db.prepare('DELETE FROM content_fts WHERE content_id = ?');
const ftsInsert = db.prepare(
  'INSERT INTO content_fts (title, description, notes, body, tags, content_id) VALUES (?, ?, ?, ?, ?, ?)'
);
const tagsForContent = db.prepare(
  `SELECT t.name FROM tags t JOIN content_tags ct ON ct.tag_id = t.id WHERE ct.content_id = ?`
);
const contentById = db.prepare('SELECT * FROM content WHERE id = ?');

/**
 * FTS5 virtual tables must not be UPDATEd — always delete the old row and
 * reinsert a fresh one.
 */
function syncFts(contentId) {
  const row = contentById.get(contentId);
  ftsDelete.run(contentId);
  if (!row) return;
  const tags = tagsForContent
    .all(contentId)
    .map((t) => t.name)
    .join(' ');
  ftsInsert.run(
    row.title,
    row.description,
    row.notes,
    stripHtml(row.body),
    tags,
    contentId
  );
}

function removeFts(contentId) {
  ftsDelete.run(contentId);
}

/** Replace the tag set for a content item (names are free-form, deduped). */
const findTag = db.prepare('SELECT id FROM tags WHERE name = ?');
const insertTag = db.prepare('INSERT INTO tags (name) VALUES (?)');
const clearContentTags = db.prepare(
  'DELETE FROM content_tags WHERE content_id = ?'
);
const linkTag = db.prepare(
  'INSERT OR IGNORE INTO content_tags (content_id, tag_id) VALUES (?, ?)'
);
const pruneTags = db.prepare(
  'DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM content_tags)'
);

const setTags = db.transaction((contentId, names) => {
  clearContentTags.run(contentId);
  const clean = [
    ...new Set(
      (names || [])
        .map((n) => String(n).trim().toLowerCase())
        .filter((n) => n.length > 0 && n.length <= 60)
    ),
  ];
  for (const name of clean) {
    let tag = findTag.get(name);
    if (!tag) {
      const info = insertTag.run(name);
      tag = { id: info.lastInsertRowid };
    }
    linkTag.run(contentId, tag.id);
  }
  pruneTags.run();
});

// Seed the built-in question library once (custom/asked questions have
// asked_by set and are never touched by this).
if (db.prepare('SELECT COUNT(*) AS n FROM prompts WHERE asked_by IS NULL').get().n === 0) {
  const seedPrompts = require('./data/prompts-seed');
  const ins = db.prepare(
    'INSERT INTO prompts (theme, text, suggested_type, sort_order) VALUES (?, ?, ?, ?)'
  );
  const tx = db.transaction((rows) => {
    for (const p of rows) ins.run(p.theme, p.text, p.suggested_type, p.sort_order);
  });
  tx(seedPrompts);
}

module.exports = { db, DIRS, UPLOAD_DIR, syncFts, removeFts, setTags, stripHtml };
