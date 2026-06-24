import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';

const CSV1 = path.join(process.cwd(), 'samples', 'server-logs.csv');

const col = (page: Page) => page.getByLabel('Column', { exact: true });
const op = (page: Page) => page.getByLabel('Operator', { exact: true });
const val = (page: Page) => page.getByLabel('Value', { exact: true });

test('filters: OR groups union two conditions', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', CSV1);
  await expect(page.getByText('15 of 15 rows')).toBeVisible();

  // Group 1: level = ERROR → 3 rows.
  await page.getByRole('button', { name: '+ Add filter' }).click();
  await col(page).selectOption('level');
  await op(page).selectOption('equals');
  await val(page).fill('ERROR');
  await expect(page.getByText('3 of 15 rows')).toBeVisible();

  // OR group: level = WARN → union is 3 ERROR + 3 WARN = 6 rows.
  await page.getByRole('button', { name: '+ OR group' }).click();
  await col(page).last().selectOption('level');
  await op(page).last().selectOption('equals');
  await val(page).last().fill('WARN');
  await expect(page.getByText('6 of 15 rows')).toBeVisible();

  // AND a condition into the WARN group (cached is true) — no WARN row is
  // cached, so that branch empties → back to the 3 ERROR rows.
  await page.getByRole('button', { name: '+ AND condition' }).last().click();
  await col(page).last().selectOption('cached');
  await op(page).last().selectOption('isTrue');
  await expect(page.getByText('3 of 15 rows')).toBeVisible();
});
