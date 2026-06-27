import path from 'node:path';
import { test, expect } from '@playwright/test';

const ACCESS_LOG = path.join(process.cwd(), 'samples', 'access.log');

test('custom log: parse an Nginx access log via the pattern builder', async ({
  page,
}) => {
  await page.goto('/');

  // Open the builder from the empty-state link.
  await page.getByRole('button', { name: 'Build a custom log format' }).click();
  const dialog = page.getByTestId('log-pattern-builder');
  await expect(dialog).toBeVisible();

  // The default Nginx template already previews its sample.
  await expect(page.getByTestId('log-preview')).toBeVisible();

  // Load the real log file; the preview updates and Parse enables.
  await dialog.locator('input[type="file"]').setInputFiles(ACCESS_LOG);
  await expect(dialog.getByText(/5 matched/)).toBeVisible();

  await dialog.getByRole('button', { name: 'Parse file' }).click();

  // Builder closes and the parsed dataset opens in the analyze view.
  await expect(page.getByTestId('log-pattern-builder')).toHaveCount(0);
  await expect(page.getByText('5 of 5 rows')).toBeVisible();
  // Named groups became columns.
  await expect(page.getByRole('button', { name: /^request/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^status/ })).toBeVisible();
});
