// Shared steps for the e2e specs
export async function startAsGuest(page) {
  await page.goto('/');
  await page.getByText('Explore as Guest').click();
  await page.getByRole('navigation', { name: 'Primary' }).waitFor();
}

// Upstream geo services are mocked so tests don't depend on Open-Meteo / OSM / NDMA uptime
export async function mockGeo(page) {
  await page.route('**/api/geo/place**', r => r.fulfill({ json: { city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana', country: 'IN' } }));
  await page.route('**/api/geo/weather**', r => r.fulfill({ json: {
    current: { temperature: 29.4, feelsLike: 34.1, humidity: 81, precipitation: 2.1, windSpeed: 12, condition: 'Rain', weatherCode: 63 },
    today: { rainMm: 78.2, rainChance: 96, max: 31, min: 23 },
    advisories: [{ level: 'yellow', type: 'rain', title: 'Heavy rain forecast today', detail: '78 mm expected.' }],
    source: { name: 'Open-Meteo', url: 'https://open-meteo.com' },
  } }));
  await page.route('**/api/geo/alerts**', r => r.fulfill({ json: { alerts: [] } }));
  await page.route('**/api/geo/facilities**', r => r.fulfill({ json: { facilities: [
    { id: 'way/1', type: 'hospital', typeLabel: 'Hospital', name: 'Osmania General Hospital', address: 'Afzal Gunj', phone: '040 2460 0146', emergency: true, lat: 17.3713, lng: 78.4747, distanceKm: 1.9 },
    { id: 'node/2', type: 'police', typeLabel: 'Police Station', name: 'Abids Police Station', address: null, phone: null, emergency: false, lat: 17.392, lng: 78.476, distanceKm: 1.3 },
  ] } }));
}
