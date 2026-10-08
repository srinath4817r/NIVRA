// The backend as Vercel compiles and runs it. Regression tests for the deployment that answered
// every request with a bare 500 ("Request failed (500)" on the login screen).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { buildLikeVercel } = require('./helpers/vercelBuild');

let build;
before(async () => { build = await buildLikeVercel(); });
after(() => { if (build) fs.rmSync(build.outDir, { recursive: true, force: true }); });

function probe(env, requests) {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'helpers', 'probe.js'), ...requests], {
    cwd: build.compiledBackend,
    // a clean environment: only what a fresh Vercel project has
    env: { PATH: process.env.PATH, NODE_ENV: 'production', VERCEL: '1', ...env },
    encoding: 'utf8',
    timeout: 60_000,
  });
  const line = r.stdout.split('\n').find(l => l.startsWith('PROBE '));
  assert.ok(line, `probe produced no result.\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
  return { ...JSON.parse(line.slice(6)), stderr: r.stderr };
}

test('compiled output contains only code: no runtime reads of non-JS files, no inlined npm sub-paths', () => {
  const source = build.files.map(f => fs.readFileSync(path.join(build.outDir, f), 'utf8')).join('\n');
  assert.doesNotMatch(source, /readFileSync\([^)]*__dirname/, 'files next to the code are not shipped by Vercel');
  assert.deepEqual(build.files.filter(f => f.includes('node_modules')), [], 'npm packages stay external (no duplicate zod / SDK copies)');
});

test('nothing configured (fresh Vercel project): starts, explains itself, never crashes', () => {
  const r = probe({}, ['GET /api/health', 'GET /api/auth/me', 'GET /api/scholarships']);
  assert.deepEqual(r.attempts, ['ok'], 'must not throw while loading');

  const health = r['GET /api/health'];
  assert.equal(health.status, 503);
  assert.equal(health.body.status, 'NOT_CONFIGURED');
  assert.deepEqual(health.body.missing.map(m => m.variable).sort(), ['DATABASE_URL', 'JWT_SECRET']);
  assert.doesNotMatch(JSON.stringify(health.body), /testsecret|postgres:\/\//, 'never echoes values');

  for (const key of ['GET /api/auth/me', 'GET /api/scholarships']) {
    assert.equal(r[key].status, 503);
    assert.match(r[key].body.error, /JWT_SECRET and DATABASE_URL/, 'tells the owner what to set');
  }
  assert.match(r.stderr, /not fully set up/, 'also written to the host logs');
});

test('a failed first load can be retried (the host retries once)', () => {
  // Same two-attempt sequence that turned the original JWT_SECRET error into
  // "Cannot read properties of undefined (reading 'length')"
  const r = probe({}, ['GET /api/health']);
  assert.ok(r.attempts.every(a => a === 'ok'));
  assert.equal(r['GET /api/health'].status, 503);
});

test('configured, but the database is unreachable: pages without data still work, others say why', () => {
  const r = probe(
    { JWT_SECRET: 'testsecret', DATABASE_URL: 'postgres://u:p@127.0.0.1:1/none' },
    ['GET /api/health', 'GET /api/auth/config', 'GET /api/scholarships', 'POST /api/auth/guest'],
  );
  assert.deepEqual(r.attempts, ['ok']);
  assert.equal(r['GET /api/health'].status, 503);
  assert.equal(r['GET /api/health'].body.database, 'unavailable');
  assert.equal(r['GET /api/auth/config'].status, 200, 'login options need no database');
  assert.equal(r['GET /api/scholarships'].status, 200, 'catalog needs no database');
  const guest = r['POST /api/auth/guest'];
  assert.equal(guest.status, 503);
  assert.match(guest.body.error, /database couldn't be reached/);
});

test('the database address is found whatever prefix Vercel\'s integration used', () => {
  const unreachable = 'postgres://u:p@127.0.0.1:1/none';
  // e.g. connecting Neon with the default "STORAGE" prefix creates STORAGE_URL / STORAGE_DATABASE_URL
  for (const name of ['STORAGE_URL', 'STORAGE_DATABASE_URL', 'POSTGRES_URL']) {
    const r = probe({ JWT_SECRET: 'testsecret', [name]: unreachable }, ['GET /api/health']);
    const health = r['GET /api/health'];
    assert.equal(health.body.status, 'DEGRADED', `${name} should be picked up (reachable check fails, but it is configured)`);
    assert.equal(health.body.database, 'unavailable');
  }
  // an unrelated URL is not mistaken for a database
  const r = probe({ JWT_SECRET: 'testsecret', SOME_API_URL: 'https://example.com/x' }, ['GET /api/health']);
  assert.equal(r['GET /api/health'].body.status, 'NOT_CONFIGURED');
  assert.deepEqual(r['GET /api/health'].body.missing.map(m => m.variable), ['DATABASE_URL']);
  // pooled beats unpooled
  const both = probe({ JWT_SECRET: 'testsecret', STORAGE_URL_NON_POOLING: unreachable, STORAGE_URL: unreachable }, ['GET /api/health']);
  assert.equal(both['GET /api/health'].body.databaseVariable, 'STORAGE_URL', 'names (never values) show which variable was used');
  assert.doesNotMatch(JSON.stringify(both['GET /api/health'].body), /postgres:\/\//);
});
