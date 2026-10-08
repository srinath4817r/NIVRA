// backend/routes/ai.js — assistant chat + photo analysis
const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const limits = require('../middleware/rateLimits');
const { requireAuth } = require('../middleware/auth');
const { imageUpload, sniffImageType } = require('../services/uploads');
const ai = require('../services/ai');
const { keywordAnswer } = require('../services/keywordAssistant');

const router = express.Router();

router.get('/status', (req, res) => {
  res.json({ claude: ai.isEnabled(), photoAnalysis: ai.isEnabled() });
});

router.post('/chat', limits.ai, validate({
  body: z.object({
    query: z.string().trim().min(1, 'Please type a question').max(2000),
    history: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      text: z.string().max(4000),
    })).max(12).default([]),
    language: z.enum(['en', 'hi', 'te', 'ta', 'mr', 'bn']).default('en'),
  }),
}), async (req, res) => {
  const { query, history, language } = req.valid.body;

  if (ai.isEnabled()) {
    try {
      return res.json(await ai.chat(query, { history, profile: req.user?.profile, language }));
    } catch (err) {
      console.error('Claude chat failed, using basic mode:', err.status || '', err.message);
    }
  }
  res.json(keywordAnswer(query));
});

router.post('/analyze-image', requireAuth, limits.ai, imageUpload.single('image'), validate({
  body: z.object({ note: z.string().max(2000).optional() }),
}), async (req, res) => {
  if (!ai.isEnabled()) {
    return res.status(503).json({ available: false, error: 'Photo analysis is not set up on this server.' });
  }
  if (!req.file) return res.status(400).json({ error: 'Attach a photo to analyse.' });
  const mimeType = sniffImageType(req.file.buffer);
  if (!mimeType || mimeType === 'image/gif') {
    return res.status(400).json({ error: 'Use a JPG, PNG or WebP photo.' });
  }
  try {
    res.json(await ai.analyzePhoto(req.file.buffer, mimeType, req.valid.body.note));
  } catch (err) {
    console.error('Photo analysis failed:', err.status || '', err.message);
    res.status(502).json({ error: "Photo analysis isn't available right now. You can still submit the report." });
  }
});

module.exports = router;
