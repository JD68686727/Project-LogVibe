import { test, expect } from '@playwright/test';

test('i18n: switching to German translates the UI, and it persists', async ({
  page,
}) => {
  await page.goto('/');
  // Default (English) chrome.
  await expect(page.getByText('Privacy-first, local CSV & log analyzer')).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();
  const panel = page.getByTestId('settings-panel');
  await panel.getByLabel('Language').selectOption('de');

  // The panel and the app chrome switch to German immediately.
  await expect(panel.getByRole('heading', { name: 'Einstellungen' })).toBeVisible();
  await page.getByRole('button', { name: 'Schließen' }).click();
  await expect(
    page.getByText('Datenschutz-first, lokaler CSV- & Log-Analyzer'),
  ).toBeVisible();

  // The choice persists across a reload.
  await page.reload();
  await expect(
    page.getByText('Datenschutz-first, lokaler CSV- & Log-Analyzer'),
  ).toBeVisible();
});
