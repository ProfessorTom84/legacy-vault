const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const express = require('express');
const logger = require('./utils/logger');

const log = logger.child('server');
const httpLog = logger.child('http');

// db.js creates the database, schema and data directories on first import.
require('./db');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const categoryRoutes = require('./routes/categories');
const contentRoutes = require('./routes/content');
const collectionRoutes = require('./routes/collections');
const mediaRoutes = require('./routes/media');
const searchRoutes = require('./routes/search');
const settingsRoutes = require('./routes/settings');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // in case a proxy (Tailscale serve, Cloudflare) sits in front

/* ---------------- startup diagnostics ---------------- */

const VERSION = (() => {
  try { return require('../package.json').version; } catch { return 'unknown'; }
})();

log.info('Legacy Vault starting', {
  version: VERSION,
  node: process.version,
  data_dir: process.env.DATA_DIR || '/data',
  log_level: process.env.LOG_LEVEL || 'info',
  log_file: logger.LOG_FILE,
});
log.info('environment summary', {
  jwt_secret: process.env.JWT_SECRET ? 'set' : 'MISSING',
  base_url: process.env.BASE_URL || '(default http://localhost:8080)',
  smtp: process.env.SMTP_HOST ? 'configured' : 'not configured (reset links print to this log)',
  max_upload_mb: process.env.MAX_UPLOAD_MB || '2048',
});

// ffmpeg is required for thumbnails/previews/waveforms — say so loudly if absent.
execFile('ffmpeg', ['-version'], (err, stdout) => {
  if (err) log.error('ffmpeg NOT FOUND — thumbnails, GIF previews and waveforms will fail', { err });
  else log.info('ffmpeg available', { version: stdout.split('\n')[0] });
});

/* ---------------- request logging ---------------- */

app.use((req, res, next) => {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const entry = {
      ms: ms.toFixed(1),
      user: req.user ? req.user.id : undefined,
      ip: req.ip,
      bytes: res.getHeader('content-length'),
    };
    const line = `${req.method} ${req.originalUrl} -> ${res.statusCode}`;
    if (req.path === '/api/health') return httpLog.debug(line, entry);
    if (res.statusCode >= 500) httpLog.error(line, entry);
    else if (res.statusCode >= 400 && ![401, 404].includes(res.statusCode)) httpLog.warn(line, entry);
    else httpLog.info(line, entry);
  });
  next();
});

/* ------------------------------------------------------------------
   HTTPS by default. When the built-in HTTPS listener is on, every plain
   http request is redirected to the https address — users never need to
   know two addresses exist. 308 preserves method and body. /api/health
   is exempt so the container healthcheck keeps hitting plain http.
   Set REDIRECT_HTTPS=false to opt out (e.g. http-only behind a proxy).
------------------------------------------------------------------ */
if (process.env.ENABLE_HTTPS !== 'false' && process.env.REDIRECT_HTTPS !== 'false') {
  const HTTPS_PUBLIC_PORT = process.env.HTTPS_PUBLIC_PORT || '8443';
  app.use((req, res, next) => {
    if (req.secure || req.path === '/api/health') return next();
    res.redirect(308, `https://${req.hostname}:${HTTPS_PUBLIC_PORT}${req.originalUrl}`);
  });
}

app.use(express.json({ limit: '5mb' })); // rich-text bodies

app.get('/api/health', (req, res) =>
  res.json({ ok: true, version: VERSION, uptime_s: Math.round(process.uptime()) })
);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/settings', settingsRoutes);

// Unknown API routes answer in JSON, never HTML. Registered before the SPA
// fallback so /api/* can never be answered with index.html.
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

/* ------------------------------------------------------------------
   Static frontend (single-container build). Vite fingerprints assets,
   so they can be cached hard; index.html must always revalidate or
   users would keep an old app shell after updates.
------------------------------------------------------------------ */
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, '..', 'public');
if (fs.existsSync(path.join(PUBLIC_DIR, 'index.html'))) {
  app.use(express.static(PUBLIC_DIR, { index: false, maxAge: '30d', immutable: true }));
  // SPA fallback: any non-API GET serves the app shell so client-side
  // routes like /content/42 work on refresh and deep links.
  app.get('*', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });
  log.info('serving frontend', { public_dir: PUBLIC_DIR });
} else {
  log.warn('no frontend build found — API-only mode (use the Vite dev server)', { public_dir: PUBLIC_DIR });
}

/**
 * Global error handler. Must be the LAST middleware and must keep all four
 * parameters — Express identifies error handlers by arity.
 */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  log.error(`unhandled route error: ${req.method} ${req.originalUrl}`, {
    err,
    user: req.user ? req.user.id : undefined,
  });
  if (res.headersSent) return;
  res.status(err.status || 500).json({ error: 'Something went wrong. Try again.' });
});

/* ---------------- process-level diagnostics ----------------
   These lines are the post-mortem trail. If the container "just stopped",
   the last lines in $DATA_DIR/logs/app.log say whether it was asked to
   stop (SIGTERM = docker stop / array shutdown), crashed, or vanished
   mid-heartbeat (power loss / OOM kill leaves no goodbye line). */

process.on('unhandledRejection', (reason) => {
  log.error('unhandledRejection (continuing)', { err: reason instanceof Error ? reason : new Error(String(reason)) });
});

process.on('uncaughtException', (err) => {
  log.error('uncaughtException — exiting', { err });
  process.exit(1);
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    log.info(`received ${sig} — shutting down cleanly (docker stop, array stop, or update)`);
    process.exit(0);
  });
}

// Hourly heartbeat: proves liveness and tracks memory over time. If the log
// ends at a heartbeat with no shutdown line after it, the process was killed
// from outside (OOM, power). RSS creeping upward across days would suggest a leak.
setInterval(() => {
  const m = process.memoryUsage();
  log.info('heartbeat', {
    uptime_h: (process.uptime() / 3600).toFixed(1),
    rss_mb: Math.round(m.rss / 1048576),
    heap_mb: Math.round(m.heapUsed / 1048576),
  });
}, 60 * 60 * 1000).unref();

const PORT = parseInt(process.env.APP_PORT || '4000', 10);
app.listen(PORT, () => log.info(`Legacy Vault listening on :${PORT} (http)`));

/* ------------------------------------------------------------------
   Built-in HTTPS. Browsers only allow camera/microphone access on
   secure origins, so in-browser recording needs an https:// address.
   A self-signed certificate is generated and persisted in $DATA_DIR/certs;
   each device accepts a one-time browser warning, after which recording
   works everywhere. Disable with ENABLE_HTTPS=false (e.g. when a reverse
   proxy or Tailscale already provides real HTTPS in front).
------------------------------------------------------------------ */
if (process.env.ENABLE_HTTPS !== 'false') {
  const { ensureCert } = require('./utils/https');
  const pems = ensureCert();
  if (pems) {
    const https = require('https');
    const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || '4443', 10);
    https
      .createServer({ key: pems.key, cert: pems.cert }, app)
      .listen(HTTPS_PORT, () =>
        log.info(`Legacy Vault listening on :${HTTPS_PORT} (https, self-signed — in-browser recording works here)`)
      );
  } else {
    log.warn('HTTPS unavailable — in-browser recording will only work behind an external HTTPS proxy');
  }
}
