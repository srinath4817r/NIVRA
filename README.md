# NIVRA — Navigate · Inform · Verify · Reach · Assist

One app for Indian citizens and students to find scholarships, education loans and government schemes, check eligibility, track applications, and get help in emergencies and disasters.

## Features

| Area | What it does |
|---|---|
| **AI assistant** | Answers in plain language (and in the app's language) using Claude, grounded in NIVRA's scheme catalog. Lists matching schemes, the documents needed and next steps. Links are restricted to official portals in the catalog. Falls back to keyword matching ("Basic mode") when no API key is set. |
| **Eligibility checker** | Asks age, gender, category, income, education, work, state and disability, then shows which schemes you likely qualify for and *why*. Unanswered questions never rule you out. Conditions it can't check are marked "confirm on the portal". |
| **Scholarships, loans, schemes, certificates** | 11 scholarships, 2 loan schemes, 12 central welfare schemes and 4 certificate guides, each with its official portal. |
| **Application tracker** | Track anything you've applied for. Mark steps done, record the portal's reference number and the real deadline, and download a calendar reminder (.ics, alerts 3 days and 1 day before). Upcoming deadlines show on Home. |
| **Emergency** | Helplines work without location or internet. With your GPS location (or a searched city) the app shows live weather, IMD-band rain/heat/wind advisories, official NDMA alerts for your state, and nearby hospitals, police, fire stations, pharmacies and shelters on a map. |
| **Disaster reports** | Report a problem with an optional photo (Claude pre-fills the type and severity) and your map position. Follow its status under Profile → My Reports. Admins triage at `/admin/reports`. |
| **SOS contacts** | Save up to 5 emergency contacts. The SOS button messages them your live location through your phone's own SMS app or share sheet. |
| **Accounts** | Email + password, Google, mobile OTP, or guest. Signing up from a guest session keeps everything you saved. Accounts can be deleted. |
| **Languages** | English, Hindi, Telugu, Tamil, Marathi and Bengali interface, plus voice input in those languages (Chrome, Edge, Safari). |
| **Works offline** | Installable app (PWA). Helplines, saved content and your last weather and facility results still open without a connection. |

## Architecture

```
frontend/   React 19 + Vite, Tailwind 4, react-router, Leaflet; PWA via vite-plugin-pwa
backend/    Express 5 API (Vercel-compatible), Postgres (pg) or embedded PGlite
  routes/     auth · user data · content · eligibility · ai · geo
  services/   ai (Claude) · eligibility · geo (Open-Meteo, Nominatim, Overpass, NDMA) · sms · uploads
  data/       scheme catalog (versioned in git)
  db/         schema.sql (applied automatically on start)
```

- **Content** (schemes, scholarships) is code in `backend/data/database.js`. **User data** (accounts, trackers, saved items, reports, photos) is in Postgres.
- **Sessions** are signed JWTs in an `httpOnly`, `SameSite=Lax` cookie. The frontend calls `/api` on the same origin.
- **Location services** are called through the backend so responses are cached and each provider's usage policy is respected.

## Run locally

Requires Node 20+.

```bash
# API: http://localhost:5000/api (uses an embedded database in backend/.data/, no setup needed)
cd backend && npm install && npm run dev

# App: http://localhost:5173 (proxies /api to the backend)
cd frontend && npm install && npm run dev
```

Without any keys you get a fully working app. AI answers use Basic mode, photo analysis is off, mobile OTP codes are shown on screen, and Google sign-in is hidden.

## Configuration

Copy `backend/.env.example` to `backend/.env` locally. On Vercel, set these under **Project → Settings → Environment Variables**.

| Variable | Needed for | Notes |
|---|---|---|
| `JWT_SECRET` | **Required in production** | Any long random string (`openssl rand -hex 32`). The server refuses to start in production without it. |
| `DATABASE_URL` | **Required in production** | Postgres connection string ([Neon](https://neon.tech) or [Supabase](https://supabase.com) free tiers work). Without it, Vercel uses an in-memory database that is wiped on every cold start. |
| `ANTHROPIC_API_KEY` | AI assistant, photo analysis | From the [Claude Console](https://platform.claude.com). Model defaults to `claude-opus-5-5`; override with `ANTHROPIC_MODEL`. |
| `GOOGLE_CLIENT_ID` | Google sign-in | OAuth 2.0 **Web** client ID from Google Cloud Console. Add your site's origin to *Authorized JavaScript origins*. |
| `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Mobile OTP in production | Without these, mobile sign-in is hidden in production. Indian numbers need DLT-registered templates with most providers. |
| `ADMIN_EMAILS` | Report triage | Comma-separated emails that can open `/admin/reports`. |
| `CORS_ORIGINS` | Only for a separate frontend domain | Not needed when frontend and API share a domain (the default). |
| `SENTRY_DSN` (backend), `VITE_SENTRY_DSN` (frontend) | Error tracking (optional) | Loaded only when set. |

## Deploy (Vercel)

`vercel.json` deploys `frontend/` and `backend/` as services, with `/api/*` routed to the backend.

1. Set the environment variables above, at least `JWT_SECRET` and `DATABASE_URL`.
2. Deploy, then **open a deep link such as `/profile` directly and refresh it**. If it returns 404, add a rewrite that serves `index.html` for non-`/api` paths to the frontend service. (After the first visit, the service worker covers this, but first visits need the rewrite.)
3. Check `https://<your-domain>/api/health`. It reports database status.

## Tests

```bash
cd backend && npm test                  # 36 API tests on an in-memory Postgres; no network or keys needed
cd frontend && npm run lint && npm run build
cd frontend && npx playwright install chromium && npm run test:e2e   # 7 browser tests (real backend + production build)
```

CI (`.github/workflows/ci.yml`) runs all three on every pull request. External services (Claude, Open-Meteo, OpenStreetMap, NDMA) are mocked in tests.

## Before launch: please review

- **Scheme data.** The catalog summarises published rules but has not been verified against official sources. Amounts and limits change every year. Each item links to its official portal, and the app tells users to confirm there. Have someone check every entry, and recheck yearly.
- **No exact deadlines.** NIVRA deliberately shows each scheme's usual application window instead of a date. Users enter the real deadline from the portal on their tracker.
- **Translations** were machine-assisted and need review by native speakers. Scheme names and rules stay in English on purpose.
- **Weather advisories** are derived from forecasts using IMD rainfall bands and are labelled as guidance, not official warnings. Official alerts come from NDMA's SACHET feed (`SACHET_RSS_URL` to override).
- **Facilities** come from OpenStreetMap and can be incomplete or outdated in some areas. Relief camps are announced by State Disaster Management Authorities; the app points users to 1070.
- **Usage policies.** Nominatim and the public Overpass and OSM tile servers are free but rate-limited. For real traffic, use a commercial or self-hosted tile and geocoding provider.
- **Device storage.** For offline use, the app keeps the last signed-in user's name and emergency contacts in the browser.
