import path from 'node:path';
import { test, expect } from '@playwright/test';

const sample = (name: string) => path.join(process.cwd(), 'samples', name);

test('rejects an unsupported file type with a clear message', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', sample('unsupported.json'));
  await expect(page.getByText(/Unsupported file type/)).toBeVisible();
});

test('shows an error for an empty file (no header row)', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', sample('empty.csv'));
  await expect(page.getByText(/empty or has no header row/)).toBeVisible();
});
