import path from 'node:path';
import { test, expect } from '@playwright/test';

const CSV1 = path.join(process.cwd(), 'samples', 'server-logs.csv');

test('table: open a row detail, navigate, and filter from a field', async ({
  page,
}) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', CSV1);
  await expect(page.getByText('15 of 15 rows')).toBeVisible();

  // Click the first data row (by its unique timestamp) → detail drawer.
  await page.getByText('2026-06-19T08:01:12').click();
  const drawer = page.getByTestId('row-detail');
  await expect(drawer).toBeVisible();
  // Row 1: endpoint /api/users, client_ip 10.0.0.4.
  await expect(drawer.getByText('/api/users', { exact: true })).toBeVisible();
  await expect(drawer.getByText('10.0.0.4', { exact: true })).toBeVisible();

  // Step to row 2 (endpoint /api/users/12).
  await drawer.getByLabel('Next row').click();
  await expect(drawer.getByText('/api/users/12', { exact: true })).toBeVisible();

  // Filter by this row's level (INFO) → 9 of 15 rows, drawer closes.
  await drawer.getByLabel('Filter by level').click();
  await expect(page.getByTestId('row-detail')).toHaveCount(0);
  await expect(page.getByText('9 of 15 rows')).toBeVisible();
});
