const path = require('path');
const fs = require('fs');
const express = require('express');

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

app.use(express.json({ limit: '5mb' })); // rich-text bodies

app.get('/api/health', (req, res) => res.json({ ok: true }));

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
   Static frontend (single-container build). The compiled React app is
   copied into ./public by the Dockerfile. Vite fingerprints assets, so
   they can be cached hard; index.html must always revalidate or users
   would keep an old app shell after updates.
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
} else {
  console.warn('[static] No frontend build found at', PUBLIC_DIR, '— API-only mode (use the Vite dev server).');
}

/**
 * Global error handler. Must be the LAST middleware and must keep all four
 * parameters — Express identifies error handlers by arity.
 */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err);
  if (res.headersSent) return;
  res.status(err.status || 500).json({ error: 'Something went wrong. Try again.' });
});

// A rejected promise anywhere should be logged, not crash the process.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

const PORT = parseInt(process.env.APP_PORT || '4000', 10);
app.listen(PORT, () => console.log(`Legacy Vault listening on :${PORT}`));
