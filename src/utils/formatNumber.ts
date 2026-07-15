/**
 * Single source of truth for displaying numbers across LogVibe (table, chart,
 * stats). The grouping/decimal locale follows the app's chosen UI language
 * (see `setNumberLocale`, called by the i18n provider): English → `1,234.5`,
 * German → `1.234,5`. Defaults to `en-US` until the provider sets it.
 *
 * Note: this is display-only. CSV export intentionally emits raw values so the
 * output re-imports cleanly, and timestamps keep their stable ISO-like format.
 */
let activeLocale = 'en-US';

/** Sets the locale used by every number formatter (called on language change). */
export function setNumberLocale(locale: string): void {
  activeLocale = locale;
}

export function formatNumber(value: number, maximumFractionDigits = 2): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString(activeLocale, { maximumFractionDigits });
}

/** Convenience for integer counts (no fraction digits), grouped per locale. */
export function formatInt(value: number): string {
  return formatNumber(value, 0);
}
