import path from 'node:path';
import { test, expect } from '@playwright/test';

const CSV = path.join(process.cwd(), 'samples', 'server-logs.csv');

test('derived columns: add a regex-extracted column, then remove it', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', CSV);
  await expect(page.getByText('15 of 15 rows')).toBeVisible();

  // Add a computed "resource" column pulling the segment after /api/.
  await page.getByRole('button', { name: /Columns/ }).click();
  await page.getByLabel('New column name').fill('resource');
  await page.getByLabel('Source column').selectOption({ label: 'endpoint' });
  await page.getByLabel('Extraction regex').fill('^/api/(\\w+)');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: /Columns/ }).click(); // close the menu

  // The new column header appears in the table with extracted values.
  const header = page.getByRole('button', { name: 'resource', exact: true });
  await expect(header).toBeVisible();
  await expect(page.getByText('users', { exact: true }).first()).toBeVisible();

  // It is sortable like any other column header (the icon appends a ▲ glyph).
  await header.click();
  await expect(page.getByRole('button', { name: /^resource/ })).toBeVisible();

  // Remove it via the column manager's ✕.
  await page.getByRole('button', { name: /Columns/ }).click();
  await page.getByRole('button', { name: 'Remove resource' }).click();
  await expect(page.getByRole('button', { name: /^resource/ })).toHaveCount(0);
});

test('derived columns: arithmetic (latency in seconds)', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', CSV);
  await expect(page.getByText('15 of 15 rows')).toBeVisible();

  await page.getByRole('button', { name: /Columns/ }).click();
  await page.getByRole('radio', { name: 'Math' }).click();
  await page.getByLabel('New column name').fill('latency_s');
  await page.getByLabel('Left operand').selectOption({ label: 'latency_ms' });
  await page.getByLabel('Operator').selectOption('/');
  await page.getByLabel('Right operand').fill('1000');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: /Columns/ }).click(); // close the menu

  // 42 ms → 0.042 s (display-rounded to 0.04) appears in the new column.
  await expect(page.getByRole('button', { name: 'latency_s', exact: true })).toBeVisible();
  await expect(page.getByText('0.04', { exact: true }).first()).toBeVisible();
});

test('derived columns: concat (text template)', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', CSV);
  await expect(page.getByText('15 of 15 rows')).toBeVisible();

  await page.getByRole('button', { name: /Columns/ }).click();
  await page.getByRole('radio', { name: 'Text' }).click();
  await page.getByLabel('New column name').fill('who');
  await page.getByLabel('Text template').fill('{client_ip} → {endpoint}');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: /Columns/ }).click(); // close the menu

  await expect(page.getByRole('button', { name: 'who', exact: true })).toBeVisible();
  await expect(
    page.getByText('10.0.0.4 → /api/users', { exact: true }).first(),
  ).toBeVisible();
});

test('derived columns: a computed column is remembered across reload', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', CSV);
  await expect(page.getByText('15 of 15 rows')).toBeVisible();

  await page.getByRole('button', { name: /Columns/ }).click();
  await page.getByLabel('New column name').fill('resource');
  await page.getByLabel('Source column').selectOption({ label: 'endpoint' });
  await page.getByLabel('Extraction regex').fill('^/api/(\\w+)');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('button', { name: 'resource', exact: true })).toBeVisible();

  // Reload (data isn't persisted) and re-open the same file: the spec re-applies.
  await page.reload();
  await page.setInputFiles('input[type="file"]', CSV);
  await expect(page.getByText('15 of 15 rows')).toBeVisible();
  await expect(page.getByRole('button', { name: 'resource', exact: true })).toBeVisible();
});
