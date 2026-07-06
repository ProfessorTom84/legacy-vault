/**
 * Legacy Vault logger — zero dependencies.
 *
 * Every line goes to two places:
 *   1. stdout/stderr  → visible via `docker logs legacy-vault`
 *   2. $DATA_DIR/logs/app.log → survives container removal/recreation,
 *      so post-mortems are possible even after `docker rm`.
 *
 * Line format (grep-friendly):
 *   2026-07-06T14:03:22.114Z INFO  [http] GET /api/content -> 200 12ms user=1
 *
 * LOG_LEVEL env: debug | info (default) | warn | error
 */
const fs = require('fs');
const path = require('path');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const LEVEL_NAMES = { 10: 'DEBUG', 20: 'INFO ', 30: 'WARN ', 40: 'ERROR' };
const threshold =
  LEVELS[String(process.env.LOG_LEVEL || 'info').toLowerCase()] || LEVELS.info;

const DATA_DIR = process.env.DATA_DIR || '/data';
const LOG_DIR = path.join(DATA_DIR, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');
const MAX_FILE_BYTES = 5 * 1024 * 1024; // rotate at 5 MB
const KEEP_ROTATIONS = 3; // app.log.1 .. app.log.3

let fileLoggingOk = true;
try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
} catch {
  fileLoggingOk = false; // read-only or missing mount — stdout still works
}

/** Strip anything secret-shaped before it can reach a log line. */
function redact(str) {
  return String(str)
    // media/auth tokens passed as query params (?token=eyJ...)
    .replace(/([?&]token=)[^&\s"']+/gi, '$1[redacted]')
    // bearer headers, if anyone ever logs one
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/g, '$1[redacted]')
    // JWT-looking blobs anywhere
    .replace(/eyJ[A-Za-z0-9._-]{20,}/g, '[redacted-jwt]');
}

function rotateIfNeeded() {
  try {
    const { size } = fs.statSync(LOG_FILE);
    if (size < MAX_FILE_BYTES) return;
    for (let i = KEEP_ROTATIONS - 1; i >= 1; i--) {
      const from = `${LOG_FILE}.${i}`;
      const to = `${LOG_FILE}.${i + 1}`;
      if (fs.existsSync(from)) fs.renameSync(from, to);
    }
    fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);
  } catch {
    /* file may not exist yet — fine */
  }
}

function writeLine(line, level) {
  const out = level >= LEVELS.warn ? process.stderr : process.stdout;
  out.write(line + '\n');
  if (!fileLoggingOk) return;
  try {
    rotateIfNeeded();
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch {
    fileLoggingOk = false; // never let logging take the app down
  }
}

/** Render extra fields as key=value pairs, JSON-encoding anything spacey. */
function fields(obj) {
  if (!obj) return '';
  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const s = v instanceof Error ? v.message : String(v);
    parts.push(`${k}=${/[\s"=]/.test(s) ? JSON.stringify(redact(s)) : redact(s)}`);
  }
  return parts.length ? ' ' + parts.join(' ') : '';
}

function log(level, scope, msg, extra) {
  if (level < threshold) return;
  const line =
    `${new Date().toISOString()} ${LEVEL_NAMES[level]} [${scope}] ` +
    redact(msg) +
    fields(extra);
  writeLine(line, level);
  // Stacks are gold for diagnosis — print them for errors, indented so
  // they visually attach to their line.
  if (extra && extra.err instanceof Error && extra.err.stack && level >= LEVELS.error) {
    writeLine(
      redact(extra.err.stack).split('\n').map((l) => '    ' + l).join('\n'),
      level
    );
  }
}

/** logger.child('media').info('...') tags every line with its subsystem. */
function child(scope) {
  return {
    debug: (msg, extra) => log(LEVELS.debug, scope, msg, extra),
    info: (msg, extra) => log(LEVELS.info, scope, msg, extra),
    warn: (msg, extra) => log(LEVELS.warn, scope, msg, extra),
    error: (msg, extra) => log(LEVELS.error, scope, msg, extra),
  };
}

module.exports = { child, redact, LOG_FILE };
