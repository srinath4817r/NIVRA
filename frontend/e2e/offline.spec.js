import { test, expect } from '@playwright/test';
import { startAsGuest } from './helpers';

test.use({ serviceWorkers: 'allow' });

test('installed app opens offline with helplines and cached content', async ({ page, context }) => {
  await startAsGuest(page);
  await page.goto('/scholarships');
  await expect(page.getByText('NMMSS').first()).toBeVisible();
  await page.goto('/emergency');
  await expect(page.getByText('All emergencies')).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  await page.goto('/emergency');
  await expect(page.getByText("You're offline")).toBeVisible();
  await expect(page.getByRole('link', { name: '112' }).first()).toBeVisible();
  await page.goto('/scholarships');
  await expect(page.getByText('NMMSS').first()).toBeVisible();
});
