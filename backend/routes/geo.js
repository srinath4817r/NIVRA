// backend/routes/geo.js — location-based data (all public, cached)
const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const geo = require('../services/geo');

const router = express.Router();

const coords = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

// Upstream outages become a clear 502 the UI can show, never a crash
const upstream = (fn) => async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=300');
    res.json(await fn(req));
  } catch (err) {
    console.warn('geo upstream error:', err.message);
    res.status(502).json({ error: 'This information is temporarily unavailable. Please try again shortly.' });
  }
};

router.get('/weather', validate({ query: coords }), upstream(req =>
  geo.getWeather(req.valid.query.lat, req.valid.query.lng)));

router.get('/place', validate({ query: coords }), upstream(req =>
  geo.reverseGeocode(req.valid.query.lat, req.valid.query.lng)));

router.get('/search', validate({ query: z.object({ q: z.string().trim().min(2).max(80) }) }), upstream(async req =>
  ({ results: await geo.searchPlaces(req.valid.query.q) })));

router.get('/facilities', validate({
  query: coords.extend({ radiusKm: z.coerce.number().min(1).max(15).default(5) }),
}), upstream(async req => {
  const { lat, lng, radiusKm } = req.valid.query;
  const facilities = await geo.getFacilities(lat, lng, radiusKm);
  return { facilities, source: { name: 'OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright' } };
}));

router.get('/alerts', validate({ query: z.object({ state: z.string().trim().max(60).optional() }) }), upstream(async req =>
  ({ alerts: await geo.getOfficialAlerts(req.valid.query.state), source: { name: 'NDMA SACHET', url: 'https://sachet.ndma.gov.in' } })));

module.exports = router;
