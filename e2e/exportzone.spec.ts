import fs from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const CSV = path.join(process.cwd(), 'samples', 'utc-events.csv');

test('export: dates can be written in the selected timezone', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', CSV);
  await expect(page.getByText('3 of 3 rows')).toBeVisible();

  await page.getByLabel('Display timezone').selectOption('Europe/Berlin');

  await page.getByRole('button', { name: /Export \d/ }).click();
  await page.getByLabel(/Dates in/).check();

  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'CSV', exact: true }).click(),
  ]);
  const file = path.join(test.info().outputDir, 'export.csv');
  await dl.saveAs(file);
  const text = await fs.readFile(file, 'utf-8');

  // 23:30 UTC → 01:30 next day in Berlin (CEST +2); the raw Z form is gone.
  expect(text).toContain('2026-06-20 01:30:00');
  expect(text).not.toContain('2026-06-19T23:30:00Z');
});
