import type { Dataset } from '@/types/dataset';
import type { TKey } from '@/lib/i18n/translations';

/** A ready-made search pattern for the one-click "quick filters" library. */
export interface QuickPattern {
  id: string;
  /** i18n key for the display name (resolved at render). */
  label: TKey;
  /** RegExp source matched against cell text (case-insensitive). */
  regex: string;
  /** i18n key for the short note shown in the dropdown. */
  hint: TKey;
}

/**
 * Built-in patterns for common log/CSV needs. Distinctive formats (IP / MAC /
 * email / UUID) match precisely anywhere in a row; HTTP status is best-effort
 * across columns (a bare 4xx/5xx token matches) — for exactness, filter the
 * status column directly.
 */
export const PATTERN_LIBRARY: QuickPattern[] = [
  {
    id: 'ipv4',
    label: 'filter.pattern.ipv4.label',
    regex: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b',
    hint: 'filter.pattern.ipv4.hint',
  },
  {
    id: 'ipv6',
    label: 'filter.pattern.ipv6.label',
    regex: '\\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}\\b',
    hint: 'filter.pattern.ipv6.hint',
  },
  {
    id: 'mac',
    label: 'filter.pattern.mac.label',
    regex: '\\b(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}\\b',
    hint: 'filter.pattern.mac.hint',
  },
  {
    id: 'email',
    label: 'filter.pattern.email.label',
    regex: '\\b[\\w.+-]+@[\\w-]+\\.[\\w.-]+\\b',
    hint: 'filter.pattern.email.hint',
  },
  {
    id: 'http-err',
    label: 'filter.pattern.http-err.label',
    regex: '\\b[45]\\d{2}\\b',
    hint: 'filter.pattern.http-err.hint',
  },
  {
    id: 'uuid',
    label: 'filter.pattern.uuid.label',
    regex: '\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b',
    hint: 'filter.pattern.uuid.hint',
  },
];

/** Cap on distinct extracted values, to bound memory + the panel. */
const EXTRACT_CAP = 1000;

/**
 * Scans the cells of `order` for every occurrence of `pattern`, returning the
 * distinct matches with their counts (most frequent first). Case-insensitive.
 */
export function extractMatches(
  dataset: Dataset,
  order: number[],
  pattern: QuickPattern,
): { value: string; count: number }[] {
  let re: RegExp;
  try {
    re = new RegExp(pattern.regex, 'gi');
  } catch {
    return [];
  }

  const counts = new Map<string, number>();
  const { rows, columns } = dataset;
  const colCount = columns.length;

  for (const rowIdx of order) {
    const row = rows[rowIdx];
    for (let c = 0; c < colCount; c++) {
      const v = row[c];
      if (v == null) continue;
      for (const m of String(v).matchAll(re)) {
        const value = m[0];
        const existing = counts.get(value);
        if (existing !== undefined) counts.set(value, existing + 1);
        else if (counts.size < EXTRACT_CAP) counts.set(value, 1);
      }
    }
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}
