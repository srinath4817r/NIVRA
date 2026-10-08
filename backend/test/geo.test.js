// Weather / alerts / facilities with a stubbed fetch (no network)
process.env.NODE_ENV = 'test';

const { test, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../server');
const db = require('../db');
const geo = require('../services/geo');

const realFetch = global.fetch;
let hits;
after(() => { global.fetch = realFetch; return db.close(); });
beforeEach(() => { hits = []; geo.clearCache(); });

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function stub(routes) {
  global.fetch = async (url, init) => {
    const u = new URL(url);
    hits.push({ host: u.host, url: String(url), init });
    const handler = routes[u.host];
    if (!handler) throw new Error(`unexpected fetch ${url}`);
    return handler(u, init);
  };
}

const METEO = {
  current: { time: '2026-10-07T14:00', temperature_2m: 29.4, relative_humidity_2m: 81, apparent_temperature: 34.1, precipitation: 2.1, weather_code: 63, wind_speed_10m: 12, wind_gusts_10m: 30 },
  daily: { precipitation_sum: [78.2, 20], temperature_2m_max: [31, 30], temperature_2m_min: [23, 22], wind_gusts_10m_max: [45, 40], precipitation_probability_max: [96, 60] },
};

test('weather: current conditions + IMD-band rain advisory', async () => {
  stub({ 'api.open-meteo.com': () => json(METEO) });
  const res = await request(app).get('/api/geo/weather?lat=17.385&lng=78.4867');
  assert.equal(res.status, 200);
  assert.equal(res.body.current.temperature, 29.4);
  assert.equal(res.body.current.condition, 'Rain');
  assert.equal(res.body.advisories.length, 1);
  assert.equal(res.body.advisories[0].level, 'yellow');
  assert.match(res.body.advisories[0].title, /Heavy rain forecast today/);

  await request(app).get('/api/geo/weather?lat=17.386&lng=78.4869');
  assert.equal(hits.length, 1, 'nearby requests are served from cache');
});

test('advisory thresholds', () => {
  const lv = (rain, temp = 30, gust = 10) => geo.deriveAdvisories({ precipitation_sum: [rain, 0], temperature_2m_max: [temp, temp], wind_gusts_10m_max: [gust, 0] }, {}).map(a => `${a.type}:${a.level}`);
  assert.deepEqual(lv(10), []);
  assert.deepEqual(lv(64.5), ['rain:yellow']);
  assert.deepEqual(lv(120), ['rain:orange']);
  assert.deepEqual(lv(210), ['rain:red']);
  assert.deepEqual(lv(0, 41), ['heat:orange']);
  assert.deepEqual(lv(0, 46, 95), ['heat:red', 'wind:red']);
});

test('weather validates coordinates and reports upstream outages as 502', async () => {
  assert.equal((await request(app).get('/api/geo/weather?lat=abc&lng=1')).status, 400);
  stub({ 'api.open-meteo.com': () => json({}, 503) });
  const res = await request(app).get('/api/geo/weather?lat=10&lng=10');
  assert.equal(res.status, 502);
  assert.match(res.body.error, /temporarily unavailable/);
});

test('facilities: Overpass results parsed, typed, sorted by distance', async () => {
  stub({
    'overpass-api.de': (u, init) => {
      assert.equal(init.method, 'POST');
      assert.match(String(init.body), /amenity%22%3D%22hospital/);
      return json({ elements: [
        { type: 'node', id: 1, lat: 17.40, lon: 78.49, tags: { amenity: 'police', name: 'Banjara Hills PS', phone: '+91 40 2785 2333' } },
        { type: 'way', id: 2, center: { lat: 17.386, lon: 78.487 }, tags: { amenity: 'hospital', name: 'Govt General Hospital', emergency: 'yes', 'addr:street': 'MJ Road' } },
        { type: 'node', id: 3, lat: 17.39, lon: 78.48, tags: { amenity: 'pharmacy' } },
        { type: 'node', id: 4, tags: { amenity: 'pharmacy' } },
      ] });
    },
  });
  const res = await request(app).get('/api/geo/facilities?lat=17.385&lng=78.4867');
  assert.equal(res.status, 200);
  const f = res.body.facilities;
  assert.equal(f.length, 3, 'elements without coordinates are skipped');
  assert.equal(f[0].name, 'Govt General Hospital');
  assert.equal(f[0].type, 'hospital');
  assert.equal(f[0].emergency, true);
  assert.equal(f[0].address, 'MJ Road');
  assert.ok(f[0].distanceKm < f[1].distanceKm);
  assert.equal(f.find(x => x.type === 'pharmacy').name, 'Pharmacy (unnamed)');
  assert.equal(f.find(x => x.type === 'police').phone, '+91 40 2785 2333');
});

test('place name and search', async () => {
  stub({
    'nominatim.openstreetmap.org': (u) => {
      assert.ok(hits.at(-1).init.headers['User-Agent'].startsWith('NIVRA'), 'Nominatim requires an identifying User-Agent');
      return json({ address: { city: 'Hyderabad', state_district: 'Hyderabad', state: 'Telangana', country_code: 'in' } });
    },
    'geocoding-api.open-meteo.com': (u) => {
      assert.equal(u.searchParams.get('countryCode'), 'IN');
      return json({ results: [{ name: 'Guntur', admin1: 'Andhra Pradesh', admin2: 'Guntur', latitude: 16.3, longitude: 80.45 }] });
    },
  });
  const place = await request(app).get('/api/geo/place?lat=17.385&lng=78.4867');
  assert.deepEqual(place.body, { city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana', country: 'IN' });
  const search = await request(app).get('/api/geo/search?q=guntur');
  assert.equal(search.body.results[0].state, 'Andhra Pradesh');
});

test('official alerts: RSS parsed, filtered to the state and last 48h', async () => {
  const recent = new Date(Date.now() - 3600e3).toUTCString();
  const old = new Date(Date.now() - 5 * 86400e3).toUTCString();
  const rss = `<?xml version="1.0"?><rss><channel>
    <item><title><![CDATA[Heavy Rainfall warning for Telangana]]></title><description>Heavy rain &amp; thunderstorm likely in Hyderabad district</description><pubDate>${recent}</pubDate><link>https://sachet.ndma.gov.in/a/1</link></item>
    <item><title>Cyclone alert</title><description>Coastal Odisha</description><pubDate>${recent}</pubDate></item>
    <item><title>Old Telangana alert</title><description>expired</description><pubDate>${old}</pubDate></item>
  </channel></rss>`;
  stub({ 'sachet.ndma.gov.in': () => new Response(rss, { status: 200 }) });
  const res = await request(app).get('/api/geo/alerts?state=Telangana');
  assert.equal(res.status, 200);
  assert.equal(res.body.alerts.length, 1);
  assert.equal(res.body.alerts[0].title, 'Heavy Rainfall warning for Telangana');
  assert.equal(res.body.alerts[0].description, 'Heavy rain & thunderstorm likely in Hyderabad district');
});
