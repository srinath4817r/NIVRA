// backend/services/geo.js — weather, alerts, place names and nearby facilities from free public APIs
//   Open-Meteo (weather + geocoding, no key) · OpenStreetMap Nominatim (reverse geocoding)
//   Overpass API (facilities from OpenStreetMap) · NDMA SACHET (official CAP alerts RSS)
// Results are cached in memory per instance to stay well inside each service's fair-use limits.

const USER_AGENT = 'NIVRA/1.0 (citizen assistance app; https://github.com/pashvith03/NIVRA)';
const SACHET_RSS_URL = process.env.SACHET_RSS_URL || 'https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml';
const OVERPASS_URL = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';

// ─────────────── tiny TTL cache ───────────────
const cache = new Map();
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await fn();
  cache.set(key, { value, expires: Date.now() + ttlMs });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return value;
}
const clearCache = () => cache.clear();

async function fetchJson(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(init.timeoutMs || 10000),
  });
  if (!res.ok) throw Object.assign(new Error(`${new URL(url).host} responded ${res.status}`), { status: 502 });
  return res.json();
}

// ~1 km grid so nearby users share cache entries (and exact positions aren't sent onward)
const round = (n, d = 2) => Number(n).toFixed(d);

function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ─────────────── Weather (Open-Meteo) ───────────────
const WMO = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Freezing rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Rain showers', 81: 'Heavy showers', 82: 'Violent showers', 85: 'Snow showers', 86: 'Snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Severe thunderstorm with hail',
};

/**
 * Advisories derived from the forecast. Rain bands follow IMD's 24-hour categories
 * (heavy ≥ 64.5 mm, very heavy ≥ 115.6 mm, extremely heavy ≥ 204.5 mm).
 * These are forecast-based guidance, NOT official warnings.
 */
function deriveAdvisories(daily, current) {
  const out = [];
  const rainToday = daily?.precipitation_sum?.[0] ?? 0;
  const rainTomorrow = daily?.precipitation_sum?.[1] ?? 0;
  const maxRain = Math.max(rainToday, rainTomorrow);
  const when = rainToday >= rainTomorrow ? 'today' : 'tomorrow';

  if (maxRain >= 204.5) out.push({ level: 'red', type: 'rain', title: `Extremely heavy rain forecast ${when}`, detail: `${Math.round(maxRain)} mm expected. Serious flood risk; avoid travel and low-lying areas, keep emergency supplies ready.` });
  else if (maxRain >= 115.6) out.push({ level: 'orange', type: 'rain', title: `Very heavy rain forecast ${when}`, detail: `${Math.round(maxRain)} mm expected. Waterlogging and flooding likely in low-lying areas.` });
  else if (maxRain >= 64.5) out.push({ level: 'yellow', type: 'rain', title: `Heavy rain forecast ${when}`, detail: `${Math.round(maxRain)} mm expected. Possible waterlogging; plan travel carefully.` });

  const maxTemp = Math.max(daily?.temperature_2m_max?.[0] ?? -99, daily?.temperature_2m_max?.[1] ?? -99);
  if (maxTemp >= 45) out.push({ level: 'red', type: 'heat', title: 'Severe heat forecast', detail: `Up to ${Math.round(maxTemp)}°C. Stay indoors 12–4 pm, drink water often, check on elderly neighbours.` });
  else if (maxTemp >= 40) out.push({ level: 'orange', type: 'heat', title: 'Very hot weather forecast', detail: `Up to ${Math.round(maxTemp)}°C. Avoid the midday sun and stay hydrated.` });

  const gust = Math.max(daily?.wind_gusts_10m_max?.[0] ?? 0, current?.wind_gusts_10m ?? 0);
  if (gust >= 90) out.push({ level: 'red', type: 'wind', title: 'Damaging winds forecast', detail: `Gusts up to ${Math.round(gust)} km/h. Stay away from trees, hoardings and weak structures.` });
  else if (gust >= 60) out.push({ level: 'orange', type: 'wind', title: 'Strong winds forecast', detail: `Gusts up to ${Math.round(gust)} km/h.` });

  if ([95, 96, 99].includes(current?.weather_code)) out.push({ level: 'orange', type: 'storm', title: 'Thunderstorm now', detail: 'Stay indoors, unplug appliances, avoid open fields and water.' });
  return out;
}

async function getWeather(lat, lng) {
  return cached(`wx:${round(lat)}:${round(lng)}`, 15 * 60 * 1000, async () => {
    const params = new URLSearchParams({
      latitude: round(lat, 3), longitude: round(lng, 3), timezone: 'auto', forecast_days: '3',
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m',
      daily: 'precipitation_sum,temperature_2m_max,temperature_2m_min,wind_gusts_10m_max,precipitation_probability_max',
    });
    const data = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`);
    const c = data.current || {};
    return {
      current: {
        temperature: c.temperature_2m,
        feelsLike: c.apparent_temperature,
        humidity: c.relative_humidity_2m,
        precipitation: c.precipitation,
        windSpeed: c.wind_speed_10m,
        condition: WMO[c.weather_code] || 'Unknown',
        weatherCode: c.weather_code,
        time: c.time,
      },
      today: {
        rainMm: data.daily?.precipitation_sum?.[0],
        rainChance: data.daily?.precipitation_probability_max?.[0],
        max: data.daily?.temperature_2m_max?.[0],
        min: data.daily?.temperature_2m_min?.[0],
      },
      advisories: deriveAdvisories(data.daily, c),
      source: { name: 'Open-Meteo', url: 'https://open-meteo.com' },
    };
  });
}

// ─────────────── Place names ───────────────
async function reverseGeocode(lat, lng) {
  return cached(`rev:${round(lat)}:${round(lng)}`, 24 * 60 * 60 * 1000, async () => {
    const params = new URLSearchParams({ format: 'jsonv2', lat: round(lat, 3), lon: round(lng, 3), zoom: '12', 'accept-language': 'en' });
    const data = await fetchJson(`https://nominatim.openstreetmap.org/reverse?${params}`);
    const a = data.address || {};
    return {
      city: a.city || a.town || a.village || a.suburb || a.county || a.state_district || null,
      district: a.state_district || a.county || null,
      state: a.state || null,
      country: a.country_code ? a.country_code.toUpperCase() : null,
    };
  });
}

async function searchPlaces(q) {
  return cached(`search:${q.toLowerCase()}`, 24 * 60 * 60 * 1000, async () => {
    const params = new URLSearchParams({ name: q, count: '6', language: 'en', countryCode: 'IN' });
    const data = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
    return (data.results || []).map(r => ({
      name: r.name, district: r.admin2 || null, state: r.admin1 || null, lat: r.latitude, lng: r.longitude,
    }));
  });
}

// ─────────────── Facilities (OpenStreetMap via Overpass) ───────────────
const FACILITY_TYPES = {
  hospital: { label: 'Hospital', filters: ['["amenity"="hospital"]', '["amenity"="clinic"]["emergency"="yes"]'] },
  police: { label: 'Police Station', filters: ['["amenity"="police"]'] },
  fire: { label: 'Fire Station', filters: ['["amenity"="fire_station"]'] },
  pharmacy: { label: 'Pharmacy', filters: ['["amenity"="pharmacy"]'] },
  shelter: { label: 'Shelter / Assembly Point', filters: ['["emergency"="assembly_point"]', '["social_facility"="shelter"]'] },
};

function classify(tags) {
  if (tags.amenity === 'hospital' || tags.amenity === 'clinic') return 'hospital';
  if (tags.amenity === 'police') return 'police';
  if (tags.amenity === 'fire_station') return 'fire';
  if (tags.amenity === 'pharmacy') return 'pharmacy';
  return 'shelter';
}

function parseOverpass(data, lat, lng) {
  const seen = new Set();
  return (data.elements || [])
    .map(el => {
      const t = el.tags || {};
      const pLat = el.lat ?? el.center?.lat;
      const pLng = el.lon ?? el.center?.lon;
      if (pLat == null || pLng == null) return null;
      const type = classify(t);
      const name = t.name || t['name:en'] || `${FACILITY_TYPES[type].label} (unnamed)`;
      const address = [t['addr:housenumber'], t['addr:street'], t['addr:suburb'] || t['addr:city']].filter(Boolean).join(', ') || null;
      return {
        id: `${el.type}/${el.id}`,
        type,
        typeLabel: FACILITY_TYPES[type].label,
        name,
        address,
        phone: t.phone || t['contact:phone'] || null,
        emergency: t.emergency === 'yes',
        openingHours: t.opening_hours || null,
        lat: pLat,
        lng: pLng,
        distanceKm: Math.round(distanceKm(lat, lng, pLat, pLng) * 10) / 10,
      };
    })
    .filter(f => f && !seen.has(`${f.name}|${f.type}|${Math.round(f.distanceKm * 5)}`) && seen.add(`${f.name}|${f.type}|${Math.round(f.distanceKm * 5)}`))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

async function getFacilities(lat, lng, radiusKm = 5) {
  const key = `fac:${round(lat)}:${round(lng)}:${radiusKm}`;
  return cached(key, 30 * 60 * 1000, async () => {
    const r = Math.round(radiusKm * 1000);
    const clauses = Object.values(FACILITY_TYPES)
      .flatMap(t => t.filters)
      .map(f => `nwr${f}(around:${r},${round(lat, 4)},${round(lng, 4)});`)
      .join('\n');
    const query = `[out:json][timeout:20];(\n${clauses}\n);out center tags 300;`;
    const data = await fetchJson(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: query }),
      timeoutMs: 25000,
    });
    return parseOverpass(data, lat, lng);
  });
}

// ─────────────── Official alerts (NDMA SACHET CAP feed) ───────────────
const decode = (s) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')
  .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function parseRss(xml) {
  const items = [];
  for (const m of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g)) {
    const field = (name) => {
      const f = m[1].match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`));
      return f ? decode(f[1]) : '';
    };
    items.push({
      title: field('title'),
      description: field('description'),
      link: field('link') || null,
      published: field('pubDate') ? new Date(field('pubDate')).toISOString() : null,
      category: field('category') || null,
      author: field('author') || null,
    });
  }
  return items;
}

async function getOfficialAlerts(state) {
  const all = await cached('sachet', 10 * 60 * 1000, async () => {
    const res = await fetch(SACHET_RSS_URL, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw Object.assign(new Error(`SACHET responded ${res.status}`), { status: 502 });
    return parseRss(await res.text());
  });
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const recent = all.filter(a => !a.published || new Date(a.published).getTime() >= cutoff);
  if (!state) return recent.slice(0, 20);
  const s = state.toLowerCase();
  return recent.filter(a => `${a.title} ${a.description}`.toLowerCase().includes(s)).slice(0, 20);
}

module.exports = {
  getWeather, reverseGeocode, searchPlaces, getFacilities, getOfficialAlerts,
  // exported for tests
  deriveAdvisories, parseOverpass, parseRss, distanceKm, clearCache, FACILITY_TYPES,
};
