// backend/routes/api.js — mounts every /api route
const express = require('express');
const db = require('../db');
const config = require('../config');
const limits = require('../middleware/rateLimits');
const { loadUser } = require('../middleware/auth');

const router = express.Router();

router.use(limits.general);

// 🩺 Health (reachable through the /api rewrite on Vercel)
router.get('/health', async (req, res) => {
  if (config.setupProblems.length) {
    // names of missing settings only, never values
    return res.status(503).json({
      status: 'NOT_CONFIGURED',
      missing: config.setupProblems.map(p => ({ variable: p.variable, fix: p.fix })),
      timestamp: new Date().toISOString(),
    });
  }
  let database = 'ok';
  try { await db.query('SELECT 1'); } catch { database = 'unavailable'; }
  res.status(database === 'ok' ? 200 : 503).json({
    status: database === 'ok' ? 'ONLINE' : 'DEGRADED',
    database,
    ...(config.databaseUrlVariable ? { databaseVariable: config.databaseUrlVariable } : {}),
    timestamp: new Date().toISOString(),
  });
});

// Until the host is configured, say so plainly instead of failing in obscure ways
router.use((req, res, next) => {
  if (!config.setupProblems.length) return next();
  res.status(503).json({
    error: `This site isn't fully set up yet. If you run it, add ${config.setupProblems.map(p => p.variable).join(' and ')} in your hosting settings and redeploy. Visit /api/health for details.`,
  });
});

// Every route below can see the signed-in user (if any)
router.use(loadUser);

router.use('/auth', require('./auth'));

// 🤖 AI assistant (Claude, with a keyword fallback)
router.use('/ai', require('./ai'));

// 📍 Weather, alerts, places and nearby facilities
router.use('/geo', require('./geo'));

// 🎓 Content: scholarships, loans, schemes, guides, facilities
router.use(require('./content'));

// 👤 Per-user data: trackers, saved items, reports, uploads
router.use(require('./user'));

// Unknown API route → JSON 404 instead of an HTML page
router.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.originalUrl });
});

module.exports = router;
