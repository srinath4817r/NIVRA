// backend/config.js — single place where environment variables are read
const crypto = require('crypto');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// The Postgres address. Vercel's database integrations (Neon, Supabase) name the variable after the
// prefix chosen when connecting (STORAGE_URL, STORAGE_DATABASE_URL, POSTGRES_URL…), so accept those
// too, as long as the value really is a Postgres address. The pooled address wins over "unpooled".
function findDatabaseUrl() {
  const isPostgres = (v) => /^postgres(ql)?:\/\//i.test(v || '');
  for (const name of ['DATABASE_URL', 'POSTGRES_URL']) {
    if (isPostgres(process.env[name])) return { name, url: process.env[name] };
  }
  const rank = (n) => (/UNPOOLED|NON_POOLING|PRISMA/.test(n) ? 2 : /(DATABASE|POSTGRES)_URL$/.test(n) ? 0 : 1);
  const [found] = Object.entries(process.env)
    .filter(([name, value]) => /URL$/.test(name) && isPostgres(value))
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
  return found ? { name: found[0], url: found[1] } : { name: '', url: '' };
}
const database = findDatabaseUrl();

// Setup problems are reported, never thrown: a crash at load time makes the host (Vercel)
// answer every request with its own generic 500 page, which hides what is actually wrong.
// While problems exist the API answers 503 with a plain explanation (see routes/api.js).
const setupProblems = [];

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  // Random, so it is never a guessable secret. In production the API refuses requests instead
  jwtSecret = crypto.randomBytes(32).toString('hex');
  if (isProduction) {
    setupProblems.push({ variable: 'JWT_SECRET', fix: 'any long random string, e.g. the output of `openssl rand -hex 32`' });
  } else if (!isTest) {
    console.warn('⚠️  JWT_SECRET not set — using a random dev secret; sessions reset on restart.');
  }
}

// Serverless hosts have no persistent disk: without a real database every account, tracker
// and report would vanish whenever the function restarts.
if (process.env.VERCEL && !database.url) {
  setupProblems.push({ variable: 'DATABASE_URL', fix: 'a Postgres connection string (Neon or Supabase free plans work)' });
}

if (setupProblems.length) {
  console.error(
    '❌ NIVRA is not fully set up. The API will answer 503 until these environment variables are set: ' +
    setupProblems.map(p => `${p.variable} (${p.fix})`).join('; ') +
    '. On Vercel: Project → Settings → Environment Variables, then redeploy.');
}

const list = (v) => (v || '').split(',').map(s => s.trim()).filter(Boolean);

module.exports = {
  isProduction,
  isTest,
  setupProblems,
  port: Number(process.env.PORT) || 5000,
  jwtSecret,
  sessionDays: 30,

  // Postgres connection (Neon, Supabase, RDS…). Unset → embedded PGlite.
  databaseUrl: database.url,
  databaseUrlVariable: database.name,   // the name only, for diagnostics
  pgliteDir: process.env.PGLITE_DIR || (isTest ? '' : require('path').join(__dirname, '.data', 'pglite')),

  corsOrigins: list(process.env.CORS_ORIGINS),
  adminEmails: list(process.env.ADMIN_EMAILS).map(e => e.toLowerCase()),

  googleClientId: process.env.GOOGLE_CLIENT_ID || '',

  // SMS for mobile OTP: 'twilio' or unset (dev: code returned in the response)
  sms: {
    provider: process.env.SMS_PROVIDER || '',
    twilioSid: process.env.TWILIO_ACCOUNT_SID || '',
    twilioToken: process.env.TWILIO_AUTH_TOKEN || '',
    twilioFrom: process.env.TWILIO_FROM_NUMBER || '',
  },

  sentryDsn: process.env.SENTRY_DSN || '',

  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-opus-5-5',
};
