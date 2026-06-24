import path from 'node:path';
import { test, expect } from '@playwright/test';

const CSV1 = path.join(process.cwd(), 'samples', 'server-logs.csv');

test('pivot: cross-tab two columns and drill into a cell', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', CSV1);
  await expect(page.getByText('15 of 15 rows')).toBeVisible();

  // Expand the pivot panel and cross-tab level × cached.
  await page.getByRole('button', { name: 'Pivot table' }).click();
  await page.getByLabel('Pivot rows').selectOption('level');
  await page.getByLabel('Pivot columns').selectOption('cached');
  await expect(page.getByTestId('pivot-table')).toBeVisible();

  // Clicking the INFO × true cell filters to level=INFO AND cached=true.
  await page.getByRole('button', { name: 'Filter INFO × true' }).click();
  await expect(page.getByText('6 of 15 rows')).toBeVisible();
});

test('pivot: a shared link restores the pivot config', async ({ page, context }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', CSV1);
  await expect(page.getByText('15 of 15 rows')).toBeVisible();

  // Configure a non-default pivot: level × cached, average of latency_ms.
  await page.getByRole('button', { name: 'Pivot table' }).click();
  await page.getByLabel('Pivot rows').selectOption('level');
  await page.getByLabel('Pivot columns').selectOption('cached');
  await page.getByLabel('Pivot aggregation').selectOption('avg');
  await page.getByLabel('Pivot measure column').selectOption('latency_ms');

  // Share → URL gains a #v= token.
  await page.getByRole('button', { name: /Share view/ }).click();
  await expect(page.getByRole('button', { name: /Link copied/ })).toBeVisible();
  const url = page.url();
  expect(url).toContain('#v=');

  // Fresh session + same file → the pivot config is restored.
  const page2 = await context.newPage();
  await page2.goto(url);
  await page2.setInputFiles('input[type="file"]', CSV1);
  await expect(page2.getByText('15 of 15 rows')).toBeVisible();
  await page2.getByRole('button', { name: 'Pivot table' }).click();
  await expect(page2.getByLabel('Pivot rows')).toHaveValue('level');
  await expect(page2.getByLabel('Pivot columns')).toHaveValue('cached');
  await expect(page2.getByLabel('Pivot aggregation')).toHaveValue('avg');
  await expect(page2.getByLabel('Pivot measure column')).toHaveValue('latency_ms');
  await page2.close();
});
