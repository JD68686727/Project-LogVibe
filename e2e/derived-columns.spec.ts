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
