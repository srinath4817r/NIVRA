import { test, expect } from '@playwright/test';
import { startAsGuest, mockGeo } from './helpers';

test('eligibility checker ranks schemes and remembers answers', async ({ page }) => {
  await startAsGuest(page);
  await page.goto('/eligibility');
  await page.getByLabel('Age', { exact: true }).fill('18');
  await page.getByLabel('Gender').selectOption('female');
  await page.getByLabel('Family income per year (₹)').fill('300000');
  await page.getByLabel('Category').selectOption('sc');
  await page.getByLabel('Currently studying').selectOption('ug');
  await page.getByRole('button', { name: /Check what I can get/ }).click();
  await expect(page.getByText('likely eligible', { exact: true })).toBeVisible();
  await expect(page.locator('article').filter({ hasText: 'AICTE Pragati' })).toContainText('Likely');
  await page.reload();
  await expect(page.getByLabel('Age', { exact: true })).toHaveValue('18');
});

test('tracker deadline, calendar file and home reminder', async ({ page }) => {
  await startAsGuest(page);
  await page.goto('/scholarships/sch-2');
  await page.getByRole('button', { name: 'Track Application' }).click();
  await expect(page.getByText('Now tracking')).toBeVisible();
  await page.getByRole('button', { name: /Add deadline/ }).click();
  const inFive = new Date(Date.now() + 5 * 86400e3).toISOString().slice(0, 10);
  await page.locator('input[type=date]').fill(inFive);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('5 days left')).toBeVisible();
  const download = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Add to calendar/ }).click()]).then(([d]) => d);
  expect(download.suggestedFilename()).toMatch(/\.ics$/);
  await page.goto('/');
  await expect(page.getByText(/deadline\(s\) coming up/)).toBeVisible();
});

test('emergency page: location, weather, map and report', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 17.385, longitude: 78.4867, accuracy: 20 });
  await mockGeo(page);
  await startAsGuest(page);
  await page.goto('/emergency');
  await page.getByRole('button', { name: 'Use my location' }).click();
  await expect(page.getByText('Hyderabad, Telangana').first()).toBeVisible();
  await expect(page.getByText('Heavy rain forecast today')).toBeVisible();
  await expect(page.locator('.map-pin')).toHaveCount(2);
  await page.getByRole('button', { name: /Hospitals/ }).click();
  await expect(page.locator('.map-pin')).toHaveCount(1);

  await page.getByRole('button', { name: /Report a problem/ }).click();
  await page.getByPlaceholder('Describe the situation').fill('Knee-deep water near the bus stop');
  await page.getByRole('button', { name: /Submit report/ }).click();
  await expect(page.getByText('Report submitted')).toBeVisible();
  await page.goto('/profile');
  await expect(page.getByText('Received')).toBeVisible();
});

test('language switch translates the interface', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'हिंदी' }).click();
  await expect(page.getByText('अतिथि के रूप में देखें')).toBeVisible();
  await page.getByText('अतिथि के रूप में देखें').click();
  await expect(page.getByText('मुख्य सेवाएं')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
});

test('a newly tracked item survives a slow tracker list response (race regression)', async ({ page }) => {
  await startAsGuest(page);
  // hold the initial GET /api/trackers until after the add has completed
  await page.route('**/api/trackers', async route => {
    if (route.request().method() !== 'GET') return route.continue();
    // a list snapshot taken before the insert, arriving after it
    await new Promise(r => setTimeout(r, 1500));
    await route.fulfill({ json: { success: true, count: 0, data: [] } });
  });
  await page.goto('/scholarships/sch-1');
  await page.getByRole('button', { name: 'Track Application' }).click();
  await expect(page.getByText('Now tracking')).toBeVisible();
  await page.waitForTimeout(2000);                  // stale list has now landed
  await expect(page.locator('article').filter({ hasText: 'NMMSS' })).toBeVisible();
});
