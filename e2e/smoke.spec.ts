import path from 'node:path';
import { test, expect } from '@playwright/test';

const sample = (name: string) => path.join(process.cwd(), 'samples', name);
const CSV1 = sample('server-logs.csv');
const CSV2 = sample('server-logs-2.csv');

test('analyze: load a file, filter it, and chart it', async ({ page }) => {
  await page.goto('/');

  // Ingest → table renders with inferred columns.
  await page.setInputFiles('input[type="file"]', CSV1);
  await expect(page.getByRole('button', { name: /status_code/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /latency_ms/ })).toBeVisible();
  await expect(page.getByText('15 of 15 rows')).toBeVisible(); // all rows, unfiltered

  // Filter status_code >= 500 → 3 of 15 rows.
  await page.getByRole('button', { name: '+ Add filter' }).click();
  await page.selectOption('select[aria-label="Column"]', 'status_code');
  await page.selectOption('select[aria-label="Operator"]', 'gte');
  await page.fill('input[aria-label="Value"]', '500');
  await expect(page.getByText('3 of 15 rows')).toBeVisible();

  // Chart aggregates the filtered set (lazy-loaded Recharts).
  await page.selectOption('select[aria-label="Group by column"]', 'level');
  await expect(page.locator('.recharts-bar-rectangle').first()).toBeVisible();
});

test('compare: overlay trends across two files', async ({ page }) => {
  await page.goto('/');

  await page.setInputFiles('input[type="file"]', CSV1);
  await expect(page.getByRole('button', { name: 'Compare', exact: true })).toBeVisible();

  // Add a second, schema-compatible file.
  await page.setInputFiles('input[type="file"]', CSV2);
  await expect(page.getByText('server-logs-2.csv')).toBeVisible();

  // Compare mode → group by level → 2 series × 3 levels = 6 bars.
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await page.selectOption('select[aria-label="Group by column"]', 'level');
  await expect(page.locator('.recharts-legend-item')).toHaveCount(2);
  await expect(page.locator('.recharts-bar-rectangle')).toHaveCount(6);
});
