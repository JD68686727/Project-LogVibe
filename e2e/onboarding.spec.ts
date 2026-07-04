import { test, expect } from '@playwright/test';

test('onboarding: load a bundled sample from the empty state', async ({ page }) => {
  await page.goto('/');
  // The "Server logs" sample card loads without any file picker or network.
  await page.getByRole('button', { name: /Server logs/ }).click();
  await expect(page.getByText('15 of 15 rows')).toBeVisible();
  await expect(page.getByText('server-logs.csv')).toBeVisible();
});
