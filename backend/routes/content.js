// backend/routes/content.js — public reference content (schemes, scholarships, loans, guides, facilities)
const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { checkAll } = require('../services/eligibility');
const {
  scholarships, educationLoans, governmentSchemes, serviceGuides,
  findContentItem,
} = require('../data/content');

const router = express.Router();

const listQuery = z.object({
  category: z.string().trim().max(60).optional(),
  search: z.string().trim().max(100).optional(),
});

const includesCI = (haystack, needle) => String(haystack || '').toLowerCase().includes(needle);

// Category chips (engineering, ug, pg, girls...) match category, level or tags
const CATEGORY_ALIASES = {
  engineering: ['engineering', 'btech', 'technical'],
  ug: ['ug', 'undergraduate', 'degree'],
  pg: ['pg', 'postgraduate'],
};

router.get('/scholarships', validate({ query: listQuery }), (req, res) => {
  const { category, search } = req.valid.query;
  let results = scholarships;

  if (category && category !== 'all') {
    const terms = CATEGORY_ALIASES[category.toLowerCase()] || [category.toLowerCase()];
    results = results.filter(s => terms.some(t =>
      includesCI(s.category, t) || includesCI(s.level, t) || s.tags.some(tag => tag.toLowerCase() === t)));
  }
  if (search) {
    const q = search.toLowerCase();
    results = results.filter(s =>
      includesCI(s.name, q) || includesCI(s.description, q) || s.tags.some(t => includesCI(t, q)));
  }
  res.json({ success: true, count: results.length, data: results });
});

router.get('/scholarships/:id', (req, res) => {
  const item = scholarships.find(s => s.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Scholarship not found' });
  res.json({ success: true, data: item });
});

router.get('/loans', (req, res) => {
  res.json({ success: true, count: educationLoans.length, data: educationLoans });
});

router.get('/schemes', validate({ query: listQuery }), (req, res) => {
  const { category, search } = req.valid.query;
  let results = governmentSchemes;
  if (category && category !== 'all') {
    results = results.filter(s => includesCI(s.category, category.toLowerCase()));
  }
  if (search) {
    const q = search.toLowerCase();
    results = results.filter(s =>
      includesCI(s.name, q) || includesCI(s.benefit, q) || (s.tags || []).some(t => includesCI(t, q)));
  }
  res.json({ success: true, count: results.length, data: results });
});

router.get('/schemes/:id', (req, res) => {
  const item = governmentSchemes.find(s => s.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Scheme not found' });
  res.json({ success: true, data: item });
});

router.get('/items/:id', (req, res) => {
  const item = findContentItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true, data: item });
});

router.get('/guides', (req, res) => {
  res.json({ success: true, data: serviceGuides });
});

// Eligibility check: profile in the body (works signed out too)
const profileSchema = z.object({
  age: z.coerce.number().int().min(5).max(110).optional(),
  gender: z.enum(['female', 'male', 'other']).optional(),
  annualIncome: z.coerce.number().int().min(0).max(1_00_00_00_000).optional(),
  category: z.enum(['general', 'obc', 'sc', 'st', 'ews']).optional(),
  educationLevel: z.enum(['school', 'class11-12', 'diploma', 'ug', 'pg', 'none']).optional(),
  state: z.string().trim().max(60).optional(),
  occupation: z.enum(['student', 'farmer', 'artisan', 'salaried', 'self-employed', 'unemployed', 'other']).optional(),
  disability: z.boolean().optional(),
}).strip();

router.post('/eligibility', validate({ body: z.object({ profile: profileSchema }) }), (req, res) => {
  const results = checkAll(req.valid.body.profile);
  const count = (s) => results.filter(r => r.status === s).length;
  res.json({
    success: true,
    summary: { eligible: count('eligible') + count('likely'), maybe: count('maybe'), notEligible: count('not_eligible') },
    results,
  });
});

module.exports = router;
