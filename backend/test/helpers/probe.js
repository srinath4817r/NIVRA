// Runs INSIDE the compiled output (cwd = compiled backend dir). Loads server.cjs the way a serverless
// host does (including a retry after a failed load), asks a few questions, prints JSON.
const attempts = [];
let app;
for (let i = 0; i < 2; i++) {
  try { app = require(require('path').join(process.cwd(), 'server.cjs')); attempts.push('ok'); break; }
  catch (e) { attempts.push(`${e.constructor.name}: ${e.message}`); }
}
(async () => {
  const out = { attempts };
  if (app) {
    const request = require('supertest');
    for (const p of process.argv.slice(2)) {
      const [method, url] = p.split(' ');
      const r = await request(app)[method.toLowerCase()](url);
      out[p] = { status: r.status, body: r.body };
    }
  }
  console.log('PROBE ' + JSON.stringify(out));
  process.exit(0);
})();
