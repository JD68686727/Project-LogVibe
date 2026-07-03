import path from 'node:path';
import { test, expect } from '@playwright/test';

const SSHD = path.join(process.cwd(), 'samples', 'sshd_config');
const NGINX = path.join(process.cwd(), 'samples', 'nginx.conf');
const CISCO = path.join(process.cwd(), 'samples', 'cisco-ios.conf');
const HTTPD = path.join(process.cwd(), 'samples', 'httpd.conf');

test('config audit: sshd_config hardening issues are surfaced', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Audit it for hardening issues' }).click();

  const modal = page.getByTestId('config-audit');
  await expect(modal).toBeVisible();

  await modal.locator('input[type="file"]').setInputFiles(SSHD);

  // PermitRootLogin yes → an ssh-root-login finding.
  await expect(modal.getByText('PermitRootLogin').first()).toBeVisible();
  await expect(modal.getByText('ssh-root-login')).toBeVisible();

  await modal.getByRole('button', { name: 'Open as dataset' }).click();

  await expect(page.getByText('sshd_config.audit.csv')).toBeVisible();
  await expect(page.getByRole('button', { name: /severity/ })).toBeVisible();
});

test('config audit: nginx dialect flags weak TLS', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Audit it for hardening issues' }).click();
  const modal = page.getByTestId('config-audit');
  await modal.locator('input[type="file"]').setInputFiles(NGINX);

  await expect(modal.getByText(/NGINX ·/)).toBeVisible();
  await expect(modal.getByText('nginx-weak-tls')).toBeVisible();
});

test('config audit: cisco IOS dialect flags telnet', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Audit it for hardening issues' }).click();
  const modal = page.getByTestId('config-audit');
  await modal.locator('input[type="file"]').setInputFiles(CISCO);

  await expect(modal.getByText(/CISCO ·/)).toBeVisible();
  await expect(modal.getByText('cisco-telnet-vty')).toBeVisible();
});

test('config audit: apache dialect flags HTTP TRACE', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Audit it for hardening issues' }).click();
  const modal = page.getByTestId('config-audit');
  await modal.locator('input[type="file"]').setInputFiles(HTTPD);

  await expect(modal.getByText(/APACHE ·/)).toBeVisible();
  await expect(modal.getByText('apache-trace-enable')).toBeVisible();
});
