import path from 'node:path';
import { test, expect } from '@playwright/test';

const CSV = path.join(process.cwd(), 'samples', 'utc-events.csv');

test('timezone: switching the display zone converts date cells', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', CSV);
  await expect(page.getByText('3 of 3 rows')).toBeVisible();

  // Default UTC: the timestamp shows verbatim.
  await expect(page.getByText('2026-06-19 23:30:00')).toBeVisible();

  // Switch to Europe/Berlin (CEST +2 in June): +2h, crossing midnight.
  await page.getByLabel('Display timezone').selectOption('Europe/Berlin');
  await expect(page.getByText('2026-06-20 01:30:00')).toBeVisible();
  await expect(page.getByText('2026-06-19 23:30:00')).toHaveCount(0);
});
