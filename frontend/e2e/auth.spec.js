import { test, expect } from '@playwright/test';
import { startAsGuest } from './helpers';

test('guest tracks a scholarship, signs up, and keeps the data', async ({ page }) => {
  await startAsGuest(page);
  await page.goto('/scholarships/sch-3');
  await page.getByRole('button', { name: 'Track Application' }).click();
  await expect(page.getByText('Now tracking')).toBeVisible();

  await page.getByRole('button', { name: 'Create account' }).first().click();
  const email = `asha${Date.now()}@example.com`;
  await page.getByPlaceholder('Asha Rao').fill('Asha Rao');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill('supersecret1');
  await page.locator('form').getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.locator('article').filter({ hasText: 'AICTE Pragati' })).toBeVisible();

  // log out, wrong password, then back in
  await page.getByRole('button', { name: /Log Out/ }).click();
  await page.getByRole('button', { name: 'Yes, log out' }).click();
  await page.getByText('Continue with Email').click();
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.locator('input[type=password]').fill('wrong-password');
  await page.locator('form').getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Incorrect email or password.')).toBeVisible();
  await page.locator('input[type=password]').fill('supersecret1');
  await page.locator('form').getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  await page.goto('/profile');
  await expect(page.locator('article').filter({ hasText: 'AICTE Pragati' })).toBeVisible();
});

test('mobile OTP sign-in (dev mode shows the code)', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Continue with Mobile').click();
  await page.getByPlaceholder('98765 43210').fill('9876501234');
  await page.getByRole('button', { name: /Send code/ }).click();
  const code = (await page.locator('b.font-mono').textContent()).trim();
  await page.getByLabel('Digit 1').fill(code);
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
});

test.describe('when the server is broken the login screen says so', () => {
  test('not set up yet: shows the server\'s explanation', async ({ page }) => {
    const message = "This site isn't fully set up yet. If you run it, add JWT_SECRET and DATABASE_URL in your hosting settings and redeploy. Visit /api/health for details.";
    await page.route('**/api/auth/**', r => r.fulfill({ status: 503, json: { error: message } }));
    await page.goto('/');
    await expect(page.getByText("isn't fully set up yet")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('host error page (not JSON): friendly message instead of "Request failed (500)"', async ({ page }) => {
    await page.route('**/api/auth/**', r => r.fulfill({ status: 500, contentType: 'text/html', body: '<h1>500 Internal Server Error</h1>' }));
    await page.goto('/');
    await expect(page.getByText(/server isn't responding properly right now \(error 500\)/)).toBeVisible();
    await expect(page.getByText('Request failed (500)')).toHaveCount(0);
  });

  test('"Try again" recovers once the server is fixed', async ({ page }) => {
    let broken = true;
    await page.route('**/api/auth/**', route => (broken ? route.fulfill({ status: 503, json: { error: 'Not ready' } }) : route.continue()));
    await page.goto('/');
    await expect(page.getByText('Not ready')).toBeVisible();
    broken = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText('Explore as Guest')).toBeVisible();
  });
});
