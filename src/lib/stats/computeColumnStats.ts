import type { Dataset } from '@/types/dataset';
import type { ColumnStats } from '@/types/stats';

/**
 * Upper bound on distinct values tracked per column. Beyond this we stop
 * growing the Set and flag the count as capped — bounds memory on high-
 * cardinality columns (e.g. unique timestamps) over large files.
 */
const DISTINCT_CAP = 10_000;

/**
 * Profiles every column over the rows referenced by `order` (the filtered
 * view): non-null / null / distinct counts for all types, plus min/max/mean/sum
 * for numeric columns. Single O(rows × columns) pass over the index array — no
 * row data copied.
 */
export function computeColumnStats(dataset: Dataset, order: number[]): ColumnStats[] {
  const cols = dataset.columns;
  const n = cols.length;
  const { rows } = dataset;

  const distinct: Set<string>[] = cols.map(() => new Set<string>());
  const capped: boolean[] = cols.map(() => false);
  const nonNull = new Array<number>(n).fill(0);
  const nulls = new Array<number>(n).fill(0);
  const sum = new Array<number>(n).fill(0);
  const min = new Array<number>(n).fill(Infinity);
  const max = new Array<number>(n).fill(-Infinity);
  const numCount = new Array<number>(n).fill(0);

  for (const rowIdx of order) {
    const row = rows[rowIdx];
    for (let c = 0; c < n; c++) {
      const v = row[c];
      if (v == null || v === '') {
        nulls[c] += 1;
        continue;
      }
      nonNull[c] += 1;

      if (!capped[c]) {
        if (distinct[c].size < DISTINCT_CAP) distinct[c].add(String(v));
        else capped[c] = true;
      }

      if (cols[c].type === 'number') {
        const num = typeof v === 'number' ? v : Number(v);
        if (!Number.isNaN(num)) {
          numCount[c] += 1;
          sum[c] += num;
          if (num < min[c]) min[c] = num;
          if (num > max[c]) max[c] = num;
        }
      }
    }
  }

  return cols.map((col, c) => ({
    key: col.key,
    name: col.name,
    type: col.type,
    count: nonNull[c],
    nullCount: nulls[c],
    distinctCount: distinct[c].size,
    distinctCapped: capped[c],
    numeric:
      col.type === 'number' && numCount[c] > 0
        ? { min: min[c], max: max[c], mean: sum[c] / numCount[c], sum: sum[c] }
        : null,
  }));
}
