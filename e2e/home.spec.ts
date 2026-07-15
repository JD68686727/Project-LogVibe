import { test, expect } from '@playwright/test';

test('home: the logo returns to the start screen after loading a sample', async ({
  page,
}) => {
  await page.goto('/');
  // The home button is disabled on the empty start screen.
  const home = page.getByRole('button', { name: 'Back to start' });
  await expect(home).toBeDisabled();

  // Load a bundled sample → the workspace opens.
  await page.getByRole('button', { name: /Server logs/ }).click();
  await expect(page.getByText('15 of 15 rows')).toBeVisible();
  await expect(home).toBeEnabled();

  // Click the logo → back to the drop-zone start screen.
  await home.click();
  await expect(page.getByText('Drop your CSV or log file here')).toBeVisible();
  await expect(home).toBeDisabled();
});
