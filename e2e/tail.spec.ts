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

test('live tail: a custom log (syslog) via the pattern builder', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __tailContent: string;
      showOpenFilePicker: () => Promise<{ getFile(): Promise<File> }[]>;
    };
    w.__tailContent =
      'Oct 10 13:55:36 myhost sshd[1234]: Failed password for root from 10.0.0.5\n' +
      'Oct 10 13:55:41 myhost cron[55]: session opened for user root\n';
    w.showOpenFilePicker = async () => [
      {
        getFile: async () =>
          new File([w.__tailContent], 'syslog', { type: 'text/plain' }),
      },
    ];
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Build a custom log format' }).click();
  await page.getByRole('button', { name: 'syslog' }).click();
  await page.getByRole('button', { name: 'Tail live' }).click();

  // The named-group pattern parses the two lines into columns.
  await expect(page.getByText('2 of 2 rows')).toBeVisible();
  await expect(page.getByText('Live', { exact: true })).toBeVisible();
  await expect(page.getByText('myhost').first()).toBeVisible();

  // A newly appended syslog line is picked up.
  await page.evaluate(() => {
    const w = window as unknown as { __tailContent: string };
    w.__tailContent += 'Oct 10 13:56:00 myhost sshd[1234]: Accepted publickey\n';
  });
  await expect(page.getByText('3 of 3 rows')).toBeVisible({ timeout: 5000 });
});

test('live tail: auto-scan surfaces threat findings as the log grows', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __tailContent: string;
      showOpenFilePicker: () => Promise<{ getFile(): Promise<File> }[]>;
    };
    // One row carrying a SQLi payload → the payload-injection detector fires.
    w.__tailContent =
      'timestamp,method,url,status,client_ip\n' +
      "2026-01-01T03:00:00Z,GET,/search?q=' OR 1=1 --,200,203.0.113.9\n";
    w.showOpenFilePicker = async () => [
      {
        getFile: async () =>
          new File([w.__tailContent], 'waf.csv', { type: 'text/csv' }),
      },
    ];
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Tail it live' }).click();
  await expect(page.getByText('1 of 1 rows')).toBeVisible();

  // The live auto-scan (debounced, off the main thread) flags the payload.
  await expect(page.getByText(/finding/)).toBeVisible({ timeout: 6000 });
});
