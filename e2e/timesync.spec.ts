import path from 'node:path';
import { test, expect } from '@playwright/test';

const A = path.join(process.cwd(), 'samples', 'sync-a.csv');
const B = path.join(process.cwd(), 'samples', 'sync-b.csv');

const tick = (label: string) =>
  `.recharts-cartesian-axis-tick-value:has-text("${label}")`;

test('compare time-sync: a per-file offset aligns two logs on the hour axis', async ({
  page,
}) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', A);
  await expect(page.getByRole('button', { name: 'Compare', exact: true })).toBeVisible();
  // Wait for the first file's worker parse before adding the second.
  await page.setInputFiles('input[type="file"]', B);
  await expect(page.getByText('sync-b.csv')).toBeVisible();

  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await page.selectOption('select[aria-label="Group by column"]', 'timestamp');
  await page.selectOption('select[aria-label="Date bucket"]', 'hour');

  // Misaligned: A sits in the 08:00 hour bucket, B in 07:00.
  await expect(page.locator(tick('2026-06-19 07:00'))).toHaveCount(1);
  await expect(page.locator(tick('2026-06-19 08:00'))).toHaveCount(1);

  // Shift file B forward by 1 h (3600 s) → both land in the 08:00 bucket.
  const rowB = page
    .getByTestId('compare-file-row')
    .filter({ hasText: 'sync-b.csv' });
  await rowB.getByLabel(/Time offset in seconds for sync-b/).fill('3600');

  await expect(page.locator(tick('2026-06-19 07:00'))).toHaveCount(0);
  await expect(page.locator(tick('2026-06-19 08:00'))).toHaveCount(1);
});
