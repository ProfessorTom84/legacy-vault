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
app.set('trust proxy', 1); // behind nginx

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

// Unknown API routes answer in JSON, never HTML.
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

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

const PORT = 4000;
app.listen(PORT, () => console.log(`Legacy Vault API listening on :${PORT}`));
