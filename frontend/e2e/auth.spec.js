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
