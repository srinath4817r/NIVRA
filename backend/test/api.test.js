// Run: npm test   (uses an in-memory Postgres via PGlite)
process.env.NODE_ENV = 'test';
process.env.ADMIN_EMAILS = 'admin@nivra.test';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../server');
const db = require('../db');

after(() => db.close());

// A supertest agent keeps cookies, i.e. behaves like one browser
const browser = () => request.agent(app);
const PNG_1PX = Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C6360000002000154A24F5D0000000049454E44AE426082', 'hex');

async function registered(email = `u${Date.now()}${Math.random()}@nivra.test`) {
  const agent = browser();
  const res = await agent.post('/api/auth/register').send({ name: 'Asha Rao', email, password: 'correct horse' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { agent, user: res.body.user, email };
}

test('health reports database status', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.database, 'ok');
});

test('unknown API routes return JSON 404', async () => {
  const res = await request(app).get('/api/nope');
  assert.equal(res.status, 404);
  assert.equal(res.body.error, 'Not Found');
});

test('content: scholarship category chips match level and tags', async () => {
  const res = await request(app).get('/api/scholarships?category=engineering');
  assert.equal(res.status, 200);
  assert.ok(res.body.count > 0);
  const missing = await request(app).get('/api/scholarships/does-not-exist');
  assert.equal(missing.status, 404);
});

test('register → me → logout → login', async () => {
  const { agent, user, email } = await registered();
  assert.equal(user.name, 'Asha Rao');
  assert.equal(user.password_hash, undefined, 'never leak password hashes');

  const me = await agent.get('/api/auth/me');
  assert.equal(me.body.user.email, email);

  await agent.post('/api/auth/logout');
  assert.equal((await agent.get('/api/auth/me')).body.user, null);

  const bad = await agent.post('/api/auth/login').send({ email, password: 'wrong password' });
  assert.equal(bad.status, 401);
  const good = await agent.post('/api/auth/login').send({ email: email.toUpperCase(), password: 'correct horse' });
  assert.equal(good.status, 200);
});

test('register validates input and rejects duplicate emails', async () => {
  const short = await browser().post('/api/auth/register').send({ name: 'X', email: 'x@nivra.test', password: 'short' });
  assert.equal(short.status, 400);
  assert.match(short.body.error, /password/);

  const { email } = await registered();
  const dup = await browser().post('/api/auth/register').send({ name: 'Y', email, password: 'another one' });
  assert.equal(dup.status, 409);
});

test('session cookie is httpOnly and SameSite=Lax', async () => {
  const res = await browser().post('/api/auth/register')
    .send({ name: 'C', email: `c${Date.now()}@nivra.test`, password: 'password123' });
  const cookie = res.headers['set-cookie'].join(';');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
});

test('tampered session tokens are ignored', async () => {
  const res = await request(app).get('/api/auth/me').set('Cookie', 'nivra_session=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.bad');
  assert.equal(res.body.user, null);
});

test('mobile OTP: request, wrong code, right code', async () => {
  const agent = browser();
  const reqRes = await agent.post('/api/auth/otp/request').send({ phone: '98765 43210' });
  assert.equal(reqRes.status, 200);
  assert.match(reqRes.body.devCode, /^\d{6}$/, 'dev mode returns the code');

  const wrong = await agent.post('/api/auth/otp/verify').send({ phone: '9876543210', code: '000000' === reqRes.body.devCode ? '111111' : '000000' });
  assert.equal(wrong.status, 400);

  const ok = await agent.post('/api/auth/otp/verify').send({ phone: '+91 98765 43210', code: reqRes.body.devCode });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.phone, '+919876543210');

  const reused = await browser().post('/api/auth/otp/verify').send({ phone: '9876543210', code: reqRes.body.devCode });
  assert.equal(reused.status, 400, 'codes are single-use');
});

test('mobile OTP rejects invalid numbers and caps sends per phone', async () => {
  const bad = await browser().post('/api/auth/otp/request').send({ phone: '12345' });
  assert.equal(bad.status, 400);

  const phone = '9123456780';
  for (let i = 0; i < 3; i++) assert.equal((await browser().post('/api/auth/otp/request').send({ phone })).status, 200);
  assert.equal((await browser().post('/api/auth/otp/request').send({ phone })).status, 429);
});

test('google sign-in is refused when not configured', async () => {
  const res = await browser().post('/api/auth/google').send({ credential: 'x'.repeat(40) });
  assert.equal(res.status, 503);
});

test('user data requires sign-in', async () => {
  for (const [method, path] of [['get', '/api/trackers'], ['post', '/api/trackers'], ['get', '/api/saved'], ['get', '/api/reports/mine']]) {
    const res = await request(app)[method](path).send({});
    assert.equal(res.status, 401, `${method} ${path}`);
  }
});

test('trackers are private to their owner', async () => {
  const a = await registered();
  const b = await registered();

  const created = await a.agent.post('/api/trackers').send({ title: 'NSP 2026', referenceNo: 'NSP/1', type: 'Scholarship' });
  assert.equal(created.status, 201);
  const id = created.body.tracker.id;

  assert.equal((await a.agent.get('/api/trackers')).body.count, 1);
  assert.equal((await b.agent.get('/api/trackers')).body.count, 0);
  assert.equal((await b.agent.delete(`/api/trackers/${id}`)).status, 404, "can't delete someone else's tracker");
  assert.equal((await b.agent.patch(`/api/trackers/${id}`).send({ stepIndex: 1, done: true })).status, 404);

  const step = await a.agent.patch(`/api/trackers/${id}`).send({ stepIndex: 1, done: true });
  assert.equal(step.body.tracker.steps[1].done, true);
  assert.equal(step.body.tracker.currentStatus, 'Department Verification');

  assert.equal((await a.agent.delete(`/api/trackers/${id}`)).status, 200);
});

test('tracking the same content item twice does not duplicate', async () => {
  const { agent } = await registered();
  const body = { title: 'AICTE Pragati', referenceNo: 'R1', itemId: 'sch-3' };
  assert.equal((await agent.post('/api/trackers').send(body)).status, 201);
  const again = await agent.post('/api/trackers').send(body);
  assert.equal(again.body.duplicate, true);
  assert.equal((await agent.get('/api/trackers')).body.count, 1);
  const id = (await agent.get('/api/trackers')).body.data[0].id;
  const upd = await agent.patch(`/api/trackers/${id}`).send({ deadline: '2026-11-15', referenceNo: 'NSP/26/123' });
  assert.equal(upd.status, 200, JSON.stringify(upd.body));
  assert.equal(upd.body.tracker.deadline, '2026-11-15');
  assert.equal(upd.body.tracker.referenceNo, 'NSP/26/123');
  assert.equal((await agent.patch(`/api/trackers/${id}`).send({ deadline: 'next week' })).status, 400);
  const cleared = await agent.patch(`/api/trackers/${id}`).send({ deadline: null });
  assert.equal(cleared.body.tracker.deadline, null);
});

test('saved items', async () => {
  const { agent } = await registered();
  assert.equal((await agent.put('/api/saved/sch-1')).status, 200);
  assert.equal((await agent.put('/api/saved/sch-1')).status, 200, 'idempotent');
  assert.equal((await agent.put('/api/saved/nope')).status, 404);
  const list = await agent.get('/api/saved');
  assert.deepEqual(list.body.ids, ['sch-1']);
  assert.equal(list.body.data[0].item.id, 'sch-1');
  await agent.delete('/api/saved/sch-1');
  assert.deepEqual((await agent.get('/api/saved')).body.ids, []);
});

test('guest data moves to the account the guest signs up for', async () => {
  const agent = browser();
  assert.equal((await agent.post('/api/auth/guest')).status, 201);
  await agent.post('/api/trackers').send({ title: 'Guest tracker', referenceNo: 'G1' });
  await agent.put('/api/saved/gov-1');

  const res = await agent.post('/api/auth/register').send({ name: 'Ravi', email: `g${Date.now()}@nivra.test`, password: 'password123' });
  assert.equal(res.body.user.isGuest, false);
  assert.equal((await agent.get('/api/trackers')).body.data[0].title, 'Guest tracker');
  assert.deepEqual((await agent.get('/api/saved')).body.ids, ['gov-1']);
});

test('reports: image upload, privacy, admin status updates', async () => {
  const { agent } = await registered();
  const created = await agent.post('/api/reports')
    .field('category', 'Flooding').field('location', 'Sector 5 main road')
    .field('description', 'Water up to knee level').field('severity', 'HIGH')
    .field('lat', '17.38').field('lng', '78.48')
    .attach('image', PNG_1PX, { filename: 'flood.png', contentType: 'image/png' });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const { report } = created.body;
  assert.equal(report.status, 'Received');
  assert.equal(report.lat, 17.38);

  const img = await agent.get(report.image);
  assert.equal(img.status, 200);
  assert.equal(img.headers['content-type'], 'image/png');

  const stranger = await registered();
  assert.equal((await stranger.agent.get(report.image)).status, 404, "others can't see your photo");
  assert.equal((await stranger.agent.get('/api/admin/reports')).status, 403);

  const admin = await registered('admin@nivra.test');
  assert.equal(admin.user.isAdmin, true);
  const upd = await admin.agent.patch(`/api/admin/reports/${report.id}`).send({ status: 'Team Dispatched', note: 'Boat sent' });
  assert.equal(upd.status, 200);
  assert.equal((await admin.agent.get(report.image)).status, 200, 'admins can view report photos');

  const mine = await agent.get('/api/reports/mine');
  assert.equal(mine.body.data[0].status, 'Team Dispatched');
  assert.equal(mine.body.data[0].statusHistory.length, 2);
});

test('uploads reject non-images even with an image MIME type', async () => {
  const { agent } = await registered();
  const res = await agent.post('/api/reports')
    .field('location', 'Somewhere road').field('description', 'Fake image test')
    .attach('image', Buffer.from('<svg onload="alert(1)"/>'), { filename: 'x.png', contentType: 'image/png' });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /Unsupported image/);
});

test('profile update and account deletion', async () => {
  const { agent } = await registered();
  const upd = await agent.patch('/api/auth/me').send({
    profile: { annualIncome: 300000, category: 'sc', educationLevel: 'ug' },
    emergencyContacts: [{ name: 'Amma', phone: '+91 98480 22338' }],
  });
  assert.equal(upd.status, 200);
  assert.equal(upd.body.user.profile.category, 'sc');
  const merged = await agent.patch('/api/auth/me').send({ profile: { gender: 'female' } });
  assert.equal(merged.body.user.profile.category, 'sc', 'profile updates merge');

  assert.equal((await agent.patch('/api/auth/me').send({ profile: { category: 'xyz' } })).status, 400);

  await agent.delete('/api/auth/me');
  assert.equal((await agent.get('/api/auth/me')).body.user, null);
});

test('AI chat validates input', async () => {
  const res = await request(app).post('/api/ai/chat').send({ query: '' });
  assert.equal(res.status, 400);
});

test('concurrent tracking of the same item creates one tracker', async () => {
  const { agent } = await registered();
  const body = { title: 'NMMSS', referenceNo: 'R2', itemId: 'sch-1' };
  const results = await Promise.all([1, 2, 3].map(() => agent.post('/api/trackers').send(body)));
  assert.equal(results.filter(r => r.status === 201).length, 1);
  assert.equal((await agent.get('/api/trackers')).body.count, 1);
});

test('guest merge skips items the account already tracks', async () => {
  const email = `m${Date.now()}@nivra.test`;
  const owner = browser();
  await owner.post('/api/auth/register').send({ name: 'M', email, password: 'password123' });
  await owner.post('/api/trackers').send({ title: 'A', referenceNo: '1', itemId: 'sch-2' });

  const guest = browser();
  await guest.post('/api/auth/guest');
  await guest.post('/api/trackers').send({ title: 'A', referenceNo: '2', itemId: 'sch-2' });
  await guest.post('/api/trackers').send({ title: 'B', referenceNo: '3', itemId: 'sch-4' });
  const res = await guest.post('/api/auth/login').send({ email, password: 'password123' });
  assert.equal(res.status, 200);
  const items = (await guest.get('/api/trackers')).body.data.map(t => t.itemId).sort();
  assert.deepEqual(items, ['sch-2', 'sch-4']);
});

test('eligibility checker', async () => {
  const res = await request(app).post('/api/eligibility').send({ profile: {
    age: 18, gender: 'female', annualIncome: 300000, category: 'sc', educationLevel: 'ug', state: 'Telangana', occupation: 'student',
  } });
  assert.equal(res.status, 200);
  const by = Object.fromEntries(res.body.results.map(r => [r.item.id, r]));
  assert.equal(by['sch-3'].status, 'likely', 'Pragati: girl, UG, income ≤ 8L; first-year condition to confirm');
  assert.equal(by['sch-9'].status, 'likely', 'Top Class SC: SC, UG, ≤ 8L; institution to confirm');
  assert.equal(by['gov-8'].status, 'eligible', 'PMSBY: age 18–70 is the only rule');
  assert.equal(by['gov-6'].status, 'likely', 'Ujjwala never a clean pass: BPL household must be confirmed');
  assert.equal(by['gov-6'].checks.at(-1).result, 'confirm');
  assert.equal(by['sch-4'].status, 'not_eligible', 'Post-matric SC: income above 2.5L');
  assert.equal(by['sch-6'].status, 'not_eligible', 'OBC scheme for an SC student');
  assert.equal(by['sch-10'].status, 'not_eligible', 'North-east only');
  assert.equal(by['sch-7'].status, 'maybe', 'disability not answered');
  assert.equal(by['gov-2'].status, 'not_eligible', '70+ scheme');
  assert.equal(res.body.results[0].status, 'eligible', 'eligible items first');
  assert.equal(res.body.summary.eligible + res.body.summary.maybe + res.body.summary.notEligible, res.body.results.length);

  const empty = await request(app).post('/api/eligibility').send({ profile: {} });
  assert.equal(empty.body.summary.notEligible, 0, 'unanswered questions never rule you out');

  const nj = await request(app).post('/api/eligibility').send({ profile: { state: 'Jammu & Kashmir', educationLevel: 'ug', annualIncome: 100000 } });
  assert.equal(nj.body.results.find(r => r.item.id === 'sch-11').status, 'likely', '"&" and "and" match');

  assert.equal((await request(app).post('/api/eligibility').send({ profile: { category: 'vip' } })).status, 400);
});
