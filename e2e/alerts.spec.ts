import { test, expect } from '@playwright/test';

// Stubs the Notification API (to record constructions) and the file picker with
// a growable in-memory file, so the whole live-alert path runs in the browser.
test('live alerts: a new high-severity finding raises a notification', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __notifications: { title: string; body?: string }[];
      __tailContent: string;
      Notification: unknown;
      showOpenFilePicker: () => Promise<{ getFile(): Promise<File> }[]>;
    };
    w.__notifications = [];
    class FakeNotification {
      static permission = 'granted';
      static requestPermission(): Promise<string> {
        return Promise.resolve('granted');
      }
      constructor(title: string, opts?: { body?: string }) {
        w.__notifications.push({ title, body: opts?.body });
      }
    }
    w.Notification = FakeNotification;
    w.__tailContent =
      'timestamp,method,url,status,client_ip\n' +
      '2026-01-01T12:00:00Z,GET,/home,200,10.0.0.1\n';
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

  // Enable alerts before the malicious line arrives (backlog primed empty).
  await page
    .getByRole('button', { name: 'Alert on high-severity findings' })
    .click();

  // Append a request carrying a SQLi payload → a high-severity finding.
  await page.evaluate(() => {
    const w = window as unknown as { __tailContent: string };
    w.__tailContent += "2026-01-01T12:00:01Z,GET,/search?q=' OR 1=1 --,200,203.0.113.9\n";
  });
  await expect(page.getByText('2 of 2 rows')).toBeVisible({ timeout: 5000 });

  // The auto-scan flags it and a desktop notification fires.
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as unknown as { __notifications: unknown[] }).__notifications
              .length,
        ),
      { timeout: 6000 },
    )
    .toBeGreaterThan(0);
});
