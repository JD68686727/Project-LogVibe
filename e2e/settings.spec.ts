import { test, expect } from '@playwright/test';

test('settings: open panel, change theme, and confirm-guard the data reset', async ({
  page,
}) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Settings' }).click();
  const panel = page.getByTestId('settings-panel');
  await expect(panel).toBeVisible();

  // The theme control inside settings drives the same app theme as the header.
  await panel.getByLabel('Dark', { exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);

  // Clearing saved preferences is guarded by an inline confirm.
  await panel.getByRole('button', { name: 'Clear saved preferences' }).click();
  await expect(panel.getByText('Clear everything and reload?')).toBeVisible();
  await panel.getByRole('button', { name: 'Cancel' }).click();
  await expect(
    panel.getByRole('button', { name: 'Clear saved preferences' }),
  ).toBeVisible();
});
