// backend/routes/api.js — mounts every /api route
const express = require('express');
const db = require('../db');
const limits = require('../middleware/rateLimits');
const { loadUser } = require('../middleware/auth');

const router = express.Router();

router.use(limits.general);

// 🩺 Health (reachable through the /api rewrite on Vercel)
router.get('/health', async (req, res) => {
  let database = 'ok';
  try { await db.query('SELECT 1'); } catch { database = 'unavailable'; }
  res.status(database === 'ok' ? 200 : 503).json({
    status: database === 'ok' ? 'ONLINE' : 'DEGRADED',
    database,
    timestamp: new Date().toISOString(),
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
