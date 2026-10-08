// backend/db/index.js — Postgres access. Uses `pg` when DATABASE_URL is set,
// otherwise an embedded PGlite (real Postgres compiled to WASM) for local dev and tests.
const fs = require('fs');
const config = require('../config');
const schema = require('./schema');

let client = null;   // { query(sql, params) → { rows }, exec(sql), close() }
let ready = null;

async function connect() {
  if (config.databaseUrl) {
    const { Pool, types } = require('pg');
    // DATE columns stay plain 'YYYY-MM-DD' strings. By default pg builds a local-midnight Date,
    // which turns into the previous day when serialised on a server east of UTC (e.g. India).
    types.setTypeParser(types.builtins.DATE, (v) => v);
    const pool = new Pool({
      connectionString: config.databaseUrl,
      // hosted Postgres (Neon/Supabase) requires TLS; local URLs usually don't
      ssl: /localhost|127\.0\.0\.1/.test(config.databaseUrl) ? false : { rejectUnauthorized: false },
      max: 5,
    });
    // an idle client dropping (database restart, network blip) must not crash the process
    pool.on('error', (err) => console.error('Postgres pool error:', err.message));
    return {
      query: (sql, params) => pool.query(sql, params),
      exec: (sql) => pool.query(sql),
      close: () => pool.end(),
      kind: 'postgres',
    };
  }

  if (process.env.VERCEL) {
    console.warn('⚠️  DATABASE_URL is not set on Vercel — using an in-memory database. All user data is lost on every cold start.');
  }
  const { PGlite, types } = await import('@electric-sql/pglite');
  const dir = process.env.VERCEL ? '' : config.pgliteDir;
  if (dir) fs.mkdirSync(dir, { recursive: true });
  const options = { parsers: { [types.DATE]: (v) => v } };   // same plain-string dates as the pg path
  const db = dir ? new PGlite(dir, options) : new PGlite(options);
  return {
    query: (sql, params) => db.query(sql, params),
    exec: (sql) => db.exec(sql),
    close: () => db.close(),
    kind: dir ? 'pglite-file' : 'pglite-memory',
  };
}

function init() {
  if (!ready) {
    ready = (async () => {
      client = await connect();
      await client.exec(schema);
      return client;
    })().catch(err => {
      ready = null;
      console.error('Database connection failed:', err.message);
      // 503 with a message safe to show: the real cause stays in the server log
      throw Object.assign(new Error("The database couldn't be reached. If you run this site, check DATABASE_URL and that the database accepts connections."), { status: 503, expose: true });
    });
  }
  return ready;
}

async function query(sql, params = []) {
  await init();
  return client.query(sql, params);
}

async function one(sql, params) {
  const { rows } = await query(sql, params);
  return rows[0] || null;
}

async function close() {
  if (client) await client.close();
  client = null;
  ready = null;
}

module.exports = { init, query, one, close, kind: () => client?.kind };
