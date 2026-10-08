// backend/config.js — single place where environment variables are read
const crypto = require('crypto');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (isProduction) {
    // Never issue forgeable session tokens in production
    throw new Error('JWT_SECRET must be set in production (any long random string).');
  }
  jwtSecret = crypto.randomBytes(32).toString('hex');
  if (!isTest) console.warn('⚠️  JWT_SECRET not set — using a random dev secret; sessions reset on restart.');
}

const list = (v) => (v || '').split(',').map(s => s.trim()).filter(Boolean);

module.exports = {
  isProduction,
  isTest,
  port: Number(process.env.PORT) || 5000,
  jwtSecret,
  sessionDays: 30,

  // Postgres connection (Neon, Supabase, RDS…). Unset → embedded PGlite.
  databaseUrl: process.env.DATABASE_URL || '',
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
