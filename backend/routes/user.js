// backend/routes/user.js — per-user data: trackers, saved items, disaster reports, uploads
const express = require('express');
const { z } = require('zod');

const db = require('../db');
const validate = require('../middleware/validate');
const limits = require('../middleware/rateLimits');
const { requireAuth, requireAdmin, toPublicUser } = require('../middleware/auth');
const { imageUpload, saveImage } = require('../services/uploads');
const { findContentItem } = require('../data/content');

const router = express.Router();
const uuid = z.object({ id: z.uuid('Invalid id') });

// ─────────────────────────── Trackers ───────────────────────────
const DEFAULT_STEPS = (today) => [
  { name: 'Application Submitted', done: true, date: today },
  { name: 'Department Verification', done: false, date: null },
  { name: 'Approval & Benefit Disbursal', done: false, date: null },
];

const trackerOut = (t) => ({
  id: t.id,
  itemId: t.item_id,
  title: t.title,
  type: t.type,
  referenceNo: t.reference_no,
  appliedDate: t.applied_date instanceof Date ? t.applied_date.toISOString().slice(0, 10) : String(t.applied_date).slice(0, 10),
  currentStatus: t.status,
  steps: t.steps,
  nextReminder: t.next_reminder,
  deadline: t.deadline ? (t.deadline instanceof Date ? t.deadline.toISOString().slice(0, 10) : String(t.deadline).slice(0, 10)) : null,
  createdAt: t.created_at,
});

router.get('/trackers', requireAuth, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM trackers WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
  res.json({ success: true, count: rows.length, data: rows.map(trackerOut) });
});

router.post('/trackers', requireAuth, validate({
  body: z.object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    type: z.string().trim().max(60).default('Government Scheme'),
    referenceNo: z.string().trim().min(1, 'Reference number is required').max(80),
    itemId: z.string().trim().max(40).optional(),
    nextReminder: z.string().trim().max(200).optional(),
  }),
}), async (req, res) => {
  const { title, type, referenceNo, itemId, nextReminder } = req.valid.body;

  const today = new Date().toISOString().slice(0, 10);
  const deadline = itemId ? findContentItem(itemId)?.deadline || null : null;
  // the partial unique index makes concurrent "track this" clicks safe
  const row = await db.one(
    `INSERT INTO trackers (user_id, item_id, title, type, reference_no, steps, next_reminder, deadline)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id, item_id) WHERE item_id IS NOT NULL DO NOTHING
     RETURNING *`,
    [req.user.id, itemId || null, title, type, referenceNo, JSON.stringify(DEFAULT_STEPS(today)),
      nextReminder || 'Check the official portal for verification status', deadline]);
  if (!row) {
    const existing = await db.one('SELECT * FROM trackers WHERE user_id = $1 AND item_id = $2', [req.user.id, itemId]);
    return res.status(200).json({ success: true, duplicate: true, tracker: trackerOut(existing) });
  }
  res.status(201).json({ success: true, tracker: trackerOut(row) });
});

// The user records progress, the portal's reference number and the real deadline
// themselves (NIVRA can't read government systems)
router.patch('/trackers/:id', requireAuth, validate({
  params: uuid,
  body: z.object({
    stepIndex: z.number().int().min(0).max(20).optional(),
    done: z.boolean().optional(),
    referenceNo: z.string().trim().min(1).max(80).optional(),
    deadline: z.iso.date('Use YYYY-MM-DD').nullable().optional(),
  }).refine(b => (b.stepIndex === undefined) === (b.done === undefined), 'stepIndex and done go together'),
}), async (req, res) => {
  const t = await db.one('SELECT * FROM trackers WHERE id = $1 AND user_id = $2', [req.valid.params.id, req.user.id]);
  if (!t) return res.status(404).json({ error: 'Tracker not found' });

  const { stepIndex, done, referenceNo, deadline } = req.valid.body;
  let { steps, status } = t;
  if (stepIndex !== undefined) {
    if (stepIndex >= steps.length) return res.status(400).json({ error: 'Invalid step' });
    const today = new Date().toISOString().slice(0, 10);
    steps = steps.map((s, i) => (i === stepIndex ? { ...s, done, date: done ? today : null } : s));
    const last = [...steps].reverse().find(s => s.done);
    status = steps.every(s => s.done) ? 'Completed' : (last ? last.name : 'Not started');
  }

  const row = await db.one(
    `UPDATE trackers SET steps = $2, status = $3,
       reference_no = COALESCE($4, reference_no),
       deadline = CASE WHEN $5::boolean THEN $6::date ELSE deadline END
     WHERE id = $1 RETURNING *`,
    [t.id, JSON.stringify(steps), status, referenceNo ?? null, deadline !== undefined, deadline ?? null]);
  res.json({ success: true, tracker: trackerOut(row) });
});

router.delete('/trackers/:id', requireAuth, validate({ params: uuid }), async (req, res) => {
  const row = await db.one('DELETE FROM trackers WHERE id = $1 AND user_id = $2 RETURNING id', [req.valid.params.id, req.user.id]);
  if (!row) return res.status(404).json({ error: 'Tracker not found' });
  res.json({ success: true });
});

// ─────────────────────────── Saved items ───────────────────────────
router.get('/saved', requireAuth, async (req, res) => {
  const { rows } = await db.query('SELECT item_id, created_at FROM saved_items WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
  const data = rows
    .map(r => ({ savedAt: r.created_at, item: findContentItem(r.item_id) }))
    .filter(r => r.item);   // content removed since it was saved
  res.json({ success: true, ids: rows.map(r => r.item_id), data });
});

router.put('/saved/:itemId', requireAuth, validate({
  params: z.object({ itemId: z.string().max(40) }),
}), async (req, res) => {
  const { itemId } = req.valid.params;
  if (!findContentItem(itemId)) return res.status(404).json({ error: 'Item not found' });
  await db.query('INSERT INTO saved_items (user_id, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.id, itemId]);
  res.json({ success: true });
});

router.delete('/saved/:itemId', requireAuth, validate({
  params: z.object({ itemId: z.string().max(40) }),
}), async (req, res) => {
  await db.query('DELETE FROM saved_items WHERE user_id = $1 AND item_id = $2', [req.user.id, req.valid.params.itemId]);
  res.json({ success: true });
});

// ─────────────────────────── Disaster reports ───────────────────────────
const REPORT_STATUSES = ['Received', 'Verified', 'Team Dispatched', 'Resolved', 'Closed - Duplicate', 'Closed - Invalid'];

const reportOut = (r, { withContact = false } = {}) => ({
  id: r.id,
  category: r.category,
  location: r.location,
  lat: r.lat,
  lng: r.lng,
  description: r.description,
  severity: r.severity,
  status: r.status,
  statusHistory: r.status_history,
  image: r.upload_id ? `/api/uploads/${r.upload_id}` : null,
  reportedAt: r.created_at,
  ...(withContact ? { contactNumber: r.contact_number } : {}),
});

const reportBody = z.object({
  category: z.string().trim().min(1).max(60).default('General Emergency'),
  location: z.string().trim().min(3, 'Location is required').max(300),
  description: z.string().trim().min(5, 'Please describe the situation').max(2000),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('HIGH'),
  contactNumber: z.string().trim().max(20).optional().or(z.literal('')),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

router.post('/reports', requireAuth, limits.upload, imageUpload.single('image'), validate({ body: reportBody }), async (req, res) => {
  const b = req.valid.body;
  const upload = await saveImage(req.file, req.user.id);
  const history = [{ status: 'Received', at: new Date().toISOString() }];
  const row = await db.one(
    `INSERT INTO reports (user_id, category, location, lat, lng, description, severity, contact_number, upload_id, status_history)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [req.user.id, b.category, b.location, b.lat ?? null, b.lng ?? null, b.description, b.severity,
      b.contactNumber || null, upload?.id || null, JSON.stringify(history)]);
  res.status(201).json({
    success: true,
    message: 'Report received. Track its status under My Reports. If anyone is in danger, call 112 now.',
    report: reportOut(row, { withContact: true }),
  });
});

router.get('/reports/mine', requireAuth, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM reports WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
  res.json({ success: true, data: rows.map(r => reportOut(r, { withContact: true })) });
});

// Admin queue (ADMIN_EMAILS)
router.get('/admin/reports', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM reports ORDER BY created_at DESC LIMIT 200');
  res.json({ success: true, statuses: REPORT_STATUSES, data: rows.map(r => reportOut(r, { withContact: true })) });
});

router.patch('/admin/reports/:id', requireAuth, requireAdmin, validate({
  params: uuid,
  body: z.object({ status: z.enum(REPORT_STATUSES), note: z.string().trim().max(500).optional() }),
}), async (req, res) => {
  const { status, note } = req.valid.body;
  const entry = { status, at: new Date().toISOString(), by: toPublicUser(req.user).email, ...(note ? { note } : {}) };
  const row = await db.one(
    `UPDATE reports SET status = $2, status_history = status_history || $3::jsonb WHERE id = $1 RETURNING *`,
    [req.valid.params.id, status, JSON.stringify([entry])]);
  if (!row) return res.status(404).json({ error: 'Report not found' });
  res.json({ success: true, report: reportOut(row, { withContact: true }) });
});

// ─────────────────────────── Uploaded images ───────────────────────────
// Only the uploader (or an admin) can view an uploaded image
router.get('/uploads/:id', requireAuth, validate({ params: uuid }), async (req, res) => {
  const row = await db.one('SELECT user_id, mime_type, data FROM uploads WHERE id = $1', [req.valid.params.id]);
  if (!row || (row.user_id !== req.user.id && !toPublicUser(req.user).isAdmin)) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.set({
    'Content-Type': row.mime_type,
    'Cache-Control': 'private, max-age=86400',
    'Content-Disposition': 'inline',
  });
  res.send(Buffer.from(row.data));
});

module.exports = router;
