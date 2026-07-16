import type { Dataset } from '@/types/dataset';
import { safeRegExp } from '@/lib/regex/safeRegex';

/**
 * Free-text "grep across all columns" stage. Narrows an index array to rows
 * where any cell matches the query — a case-insensitive substring by default,
 * or a regular expression when `opts.regex` is set (an invalid regex is a no-op,
 * like an incomplete filter). Runs after the structured column filters, so it
 * only scans the survivors. An empty query is a no-op.
 */
export function applyQuickSearch(
  dataset: Dataset,
  order: number[],
  query: string,
  opts: { regex?: boolean } = {},
): number[] {
  const q = query.trim();
  if (q === '') return order;

  const { rows, columns } = dataset;
  const colCount = columns.length;

  if (opts.regex) {
    // safeRegExp rejects invalid *and* likely-catastrophic patterns (the search
    // runs over every cell on the main thread, and a share link can supply it).
    const re = safeRegExp(query, 'i');
    if (!re) return order; // invalid / unsafe pattern → don't filter
    return order.filter((rowIdx) => {
      const row = rows[rowIdx];
      for (let c = 0; c < colCount; c++) {
        const v = row[c];
        if (v != null && re.test(String(v))) return true;
      }
      return false;
    });
  }

  const needle = q.toLowerCase();
  return order.filter((rowIdx) => {
    const row = rows[rowIdx];
    for (let c = 0; c < colCount; c++) {
      const v = row[c];
      if (v != null && String(v).toLowerCase().includes(needle)) return true;
    }
    return false;
  });
}
