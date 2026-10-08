// backend/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const config = require('./config');
const db = require('./db');
const apiRoutes = require('./routes/api');

// Optional error tracking. sendDefaultPii is off (no cookies, IPs or user identities); review
// Sentry's data-scrubbing settings before enabling it in production.
let Sentry = null;
if (config.sentryDsn) {
  Sentry = require('@sentry/node');
  Sentry.init({ dsn: config.sentryDsn, sendDefaultPii: false, tracesSampleRate: 0, environment: process.env.VERCEL_ENV || process.env.NODE_ENV });
}

const app = express();

// Behind Vercel/other proxies: trust the first hop so rate limits see real client IPs
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-origin' } }));

// The frontend calls the API same-origin (Vercel rewrite / Vite proxy), so CORS is
// only needed for extra origins listed in CORS_ORIGINS.
const allowedOrigins = config.corsOrigins.length
  ? config.corsOrigins
  : (config.isProduction ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173']);
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// Make sure the schema exists before any request touches the database
app.use(async (req, res, next) => {
  try { await db.init(); next(); } catch (err) { next(err); }
});

app.get('/health', (req, res) => res.redirect(307, '/api/health'));
app.use('/api', apiRoutes);

// Global error handler (Express 5 forwards rejected async handlers here)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = err.status || err.statusCode || 500;
  let message = err.message;
  if (err.name === 'MulterError') {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large (max 5 MB).' : err.message;
  }
  if (err.type === 'entity.too.large') message = 'Request is too large.';
  if (status >= 500) {
    console.error('Unhandled Error:', err);
    Sentry?.captureException(err, { tags: { route: req.route?.path || req.path } });
  }
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on our side. Please try again.' : message });
});

if (require.main === module) {
  db.init().then(() => {
    app.listen(config.port, () => {
      console.log(`🚀 NIVRA API on http://localhost:${config.port}/api  (database: ${db.kind()})`);
    });
  }).catch(err => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
}

module.exports = app;
