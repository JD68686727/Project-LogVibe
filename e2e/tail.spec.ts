import { test, expect } from '@playwright/test';

// Stubs the File System Access picker with a growable in-memory file so the
// whole live-tail loop (initial parse → poll → readAppended → appendRows →
// table grows) runs for real in the browser. Only the native picker is faked.
test('live tail: appended lines are picked up and grow the table', async ({
  page,
}) => {
  await page.addInitScript(() => {
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

  // The empty-state offers live tail because the (stubbed) API is present.
  await page.getByRole('button', { name: 'Tail it live' }).click();

  // Initial parse lands one data row; the live strip appears.
  await expect(page.getByText('1 of 1 rows')).toBeVisible();
  await expect(page.getByText('Live', { exact: true })).toBeVisible();

  // Append two lines to the backing file; the poll loop picks them up (~1 s).
  await page.evaluate(() => {
    const w = window as unknown as { __tailContent: string };
    w.__tailContent +=
      '2026-01-01T00:01:00Z,WARN\n2026-01-01T00:02:00Z,ERROR\n';
  });

  await expect(page.getByText('3 of 3 rows')).toBeVisible({ timeout: 5000 });

  // Pausing stops the tail; the indicator flips.
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText('Paused', { exact: true })).toBeVisible();
});
