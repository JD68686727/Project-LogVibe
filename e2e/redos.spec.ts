import path from 'node:path';
import { test, expect } from '@playwright/test';

const CSV = path.join(process.cwd(), 'samples', 'server-logs.csv');

// A catastrophic regex must be refused (shown as invalid) rather than run over
// every cell on the main thread and freeze the tab.
test('regex search: a catastrophic pattern is rejected, not executed', async ({
  page,
}) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', CSV);
  await expect(page.getByText('15 of 15 rows')).toBeVisible();

  await page.getByRole('button', { name: 'Regex search' }).click();
  const box = page.getByRole('textbox', { name: 'Search all columns' });
  await box.fill('(a+)+$');

  // Flagged invalid and the row count is unchanged (the search didn't run).
  await expect(page.getByText('Invalid regular expression')).toBeVisible();
  await expect(page.getByText('15 of 15 rows')).toBeVisible();

  // A normal regex still filters.
  await box.fill('INFO');
  await expect(page.getByText('Invalid regular expression')).toHaveCount(0);
  await expect(page.getByText(/of 15 rows/)).toBeVisible();
});
