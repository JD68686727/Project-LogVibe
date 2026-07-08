import path from 'node:path';
import { test, expect } from '@playwright/test';

const CSV = path.join(process.cwd(), 'samples', 'server-logs.csv');

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

  // The empty-state drop zone is translated too.
  await expect(page.getByText('CSV- oder Log-Datei hier ablegen')).toBeVisible();

  // The choice persists across a reload.
  await page.reload();
  await expect(
    page.getByText('Datenschutz-first, lokaler CSV- & Log-Analyzer'),
  ).toBeVisible();
  await expect(page.getByText('CSV- oder Log-Datei hier ablegen')).toBeVisible();
});

test('i18n: the filter bar is translated after switching to German', async ({
  page,
}) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', CSV);
  await expect(page.getByText('15 of 15 rows')).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByTestId('settings-panel').getByLabel('Language').selectOption('de');
  await page.getByRole('button', { name: 'Schließen' }).click();

  // Filter bar: row count, quick-filters button, and add-filter all in German.
  await expect(page.getByText('15 von 15 Zeilen')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Schnellfilter' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Filter hinzufügen' })).toBeVisible();
});
