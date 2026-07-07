import { test, expect } from '@playwright/test';

// With a ring-buffer window configured, a growing tail evicts the oldest rows
// and stays bounded instead of climbing forever.
test('live tail: a keep-last-N window bounds the row count', async ({ page }) => {
  await page.addInitScript(() => {
    // Configure a tiny window before the app boots.
    localStorage.setItem('logvibe.tailKeepLast', '2');
    const w = window as unknown as {
      __tailContent: string;
      showOpenFilePicker: () => Promise<{ getFile(): Promise<File> }[]>;
    };
    w.__tailContent = 'ts,level\n2026-01-01T00:00:00Z,INFO\n';
    w.showOpenFilePicker = async () => [
      {
        getFile: async () =>
          new File([w.__tailContent], 'live.csv', { type: 'text/csv' }),
      },
    ];
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Tail it live' }).click();
  await expect(page.getByText('1 of 1 rows')).toBeVisible();

  // Append three lines: total would be 4, but the window keeps only the last 2.
  await page.evaluate(() => {
    const w = window as unknown as { __tailContent: string };
    w.__tailContent +=
      '2026-01-01T00:01:00Z,WARN\n2026-01-01T00:02:00Z,ERROR\n2026-01-01T00:03:00Z,FATAL\n';
  });

  await expect(page.getByText('2 of 2 rows')).toBeVisible({ timeout: 5000 });
  // The newest row survived; the oldest were evicted.
  await expect(page.getByText('FATAL').first()).toBeVisible();
  await expect(page.getByText('INFO')).toHaveCount(0);
});
