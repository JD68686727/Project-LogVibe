import { test, expect } from '@playwright/test';

test('a11y: the ? key opens the keyboard-shortcuts sheet, Esc closes it', async ({
  page,
}) => {
  await page.goto('/');

  // The header button opens the sheet.
  await page.getByRole('button', { name: 'Keyboard shortcuts' }).click();
  const sheet = page.getByTestId('keyboard-shortcuts');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('Show this help')).toBeVisible();

  // Escape closes it (ModalShell).
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('keyboard-shortcuts')).toHaveCount(0);

  // The `?` key (Shift+/) opens it too.
  await page.keyboard.press('Shift+Slash');
  await expect(page.getByTestId('keyboard-shortcuts')).toBeVisible();
});
