import type { CellValue, Dataset } from '@/types/dataset';
import type { SortKey } from '@/types/table';
import { parseToInstant } from '@/lib/time/timezone';

// One reused collator. `String.prototype.localeCompare(…, opts)` reconfigures a
// collator on every call — pathologically slow when sorting tens of thousands of
// rows; a shared Intl.Collator is orders of magnitude faster.
const collator = new Intl.Collator(undefined, { numeric: true });

/** Comparator for two non-null cells of the same logical column. */
function compareNonNull(a: CellValue, b: CellValue): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return a === b ? 0 : a ? 1 : -1;
  }
  // `numeric` handles embedded numbers in strings (e.g. "item2" < "item10").
  return collator.compare(String(a), String(b));
}

/**
 * Compares two date cells by their parsed instant, matching how filtering reads
 * dates. Sorting them lexically only works for ISO strings — `03/01/2024` or
 * `Dec 10 04:14:02` would otherwise sort alphabetically while the filter treats
 * them as instants. Unparseable values sort last (after the parseable ones).
 */
function compareInstants(
  ta: number | null,
  tb: number | null,
  a: CellValue,
  b: CellValue,
): number {
  if (ta != null && tb != null) return ta - tb;
  if (ta == null && tb == null) return collator.compare(String(a), String(b));
  return ta == null ? 1 : -1;
}

/**
 * Pure state transition for a header click:
 * - additive (Shift-click): cycle this column *within* the list — absent →
 *   append asc; asc → desc (same position); desc → remove. Others untouched.
 * - non-additive (plain click): replace the whole sort with just this column,
 *   cycling asc → desc → none.
 */
export function toggleSortKey(
  keys: SortKey[],
  columnKey: string,
  additive: boolean,
): SortKey[] {
  const existing = keys.find((k) => k.columnKey === columnKey);

  if (!additive) {
    if (!existing) return [{ columnKey, direction: 'asc' }];
    if (existing.direction === 'asc') return [{ columnKey, direction: 'desc' }];
    return []; // third plain click clears
  }

  // Additive: keep the other keys (and their order).
  if (!existing) return [...keys, { columnKey, direction: 'asc' }];
  if (existing.direction === 'asc') {
    return keys.map((k) =>
      k.columnKey === columnKey ? { ...k, direction: 'desc' } : k,
    );
  }
  return keys.filter((k) => k.columnKey !== columnKey);
}

/**
 * Sorts a *base* index array by the sort keys in priority order (first non-zero
 * comparison wins). Returns `baseOrder` untouched when there are no keys; sorts
 * a copy otherwise. Nulls always sort last regardless of direction; unknown
 * columns are skipped.
 */
export function applyMultiSort(
  dataset: Dataset,
  baseOrder: number[],
  keys: SortKey[],
): number[] {
  if (keys.length === 0) return baseOrder;

  const resolved = keys
    .map((k) => {
      const idx = dataset.columnIndex[k.columnKey];
      return {
        idx,
        dir: k.direction === 'asc' ? 1 : -1,
        isDate: idx != null && dataset.columns[idx].type === 'date',
      };
    })
    .filter((k) => k.idx != null);
  if (resolved.length === 0) return baseOrder;

  const { rows } = dataset;

  // Parse each date column once per row rather than on every comparison
  // (O(n) parses instead of O(n log n)).
  const instants = new Map<number, Map<number, number | null>>();
  for (const { idx, isDate } of resolved) {
    if (!isDate) continue;
    const byRow = new Map<number, number | null>();
    for (const rowIdx of baseOrder) {
      const v = rows[rowIdx][idx];
      byRow.set(rowIdx, v == null ? null : parseToInstant(String(v)));
    }
    instants.set(idx, byRow);
  }

  return [...baseOrder].sort((ia, ib) => {
    for (const { idx, dir, isDate } of resolved) {
      const va = rows[ia][idx];
      const vb = rows[ib][idx];
      if (va == null && vb == null) continue;
      if (va == null) return 1; // nulls last
      if (vb == null) return -1;
      const byRow = isDate ? instants.get(idx) : undefined;
      const cmp = byRow
        ? compareInstants(byRow.get(ia) ?? null, byRow.get(ib) ?? null, va, vb)
        : compareNonNull(va, vb);
      if (cmp !== 0) return cmp * dir;
    }
    return 0;
  });
}
