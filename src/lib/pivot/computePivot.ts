import type { CellValue, Dataset } from '@/types/dataset';
import type { PivotConfig, PivotResult } from '@/types/pivot';
import { OTHERS_BUCKET } from '@/types/pivot';
import { makeBucketer } from './numericBuckets';

/** Max distinct values shown per axis before the rest collapse into `(others)`. */
const AXIS_CAP = 20;

interface Axis {
  values: string[];
  /** Maps a cell to its axis position, or undefined to skip the row. */
  indexOf: (cell: CellValue) => number | undefined;
  hasOthers: boolean;
  /** Per-value numeric bounds when bucketed, else null. */
  bounds: [number, number][] | null;
}

const toNum = (c: CellValue): number =>
  typeof c === 'number' ? c : Number(c);

interface Acc {
  sum: number;
  count: number;
  /** Rows in this group with a usable numeric measure (for `avg`). */
  numCount: number;
}

const newAcc = (): Acc => ({ sum: 0, count: 0, numCount: 0 });

function reduce(acc: Acc, aggregation: PivotConfig['aggregation']): number {
  switch (aggregation) {
    case 'sum':
      return acc.sum;
    case 'avg':
      return acc.numCount > 0 ? acc.sum / acc.numCount : 0;
    case 'count':
    default:
      return acc.count;
  }
}

const isBlank = (c: CellValue): boolean => c == null || c === '';

/**
 * Picks the most frequent values for a categorical axis, capped at AXIS_CAP.
 * When the distinct count exceeds the cap, the top `CAP-1` are kept and the
 * remainder collapse into a trailing `(others)` bucket.
 */
function categoricalAxis(freq: Map<string, number>): Axis {
  const sorted = [...freq.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], undefined, { numeric: true }),
  );
  const hasOthers = sorted.length > AXIS_CAP;
  const kept = hasOthers ? sorted.slice(0, AXIS_CAP - 1) : sorted;

  const values = kept.map(([v]) => v);
  const index = new Map<string, number>(values.map((v, i) => [v, i]));
  if (hasOthers) values.push(OTHERS_BUCKET);
  const othersIdx = values.length - 1;

  return {
    values,
    // Any value beyond the cap (absent from `index`) resolves to the others bucket.
    indexOf: (cell) =>
      index.get(String(cell)) ?? (hasOthers ? othersIdx : undefined),
    hasOthers,
    bounds: null,
  };
}

const EMPTY_AXIS: Axis = {
  values: [],
  indexOf: () => undefined,
  hasOthers: false,
  bounds: null,
};

/** Buckets a numeric axis into evenly-spaced "nice" ranges spanning [min, max]. */
function bucketedAxis(min: number, max: number): Axis {
  const b = makeBucketer(min, max);
  return {
    values: Array.from({ length: b.count }, (_, i) => b.labelOf(i)),
    indexOf: (cell) => {
      const n = toNum(cell);
      return Number.isFinite(n) ? b.indexOf(n) : undefined;
    },
    hasOthers: false,
    bounds: Array.from({ length: b.count }, (_, i) => b.boundsOf(i)),
  };
}

/**
 * Cross-tabulates the rows referenced by `order` by two columns, reducing each
 * (row, column) cell per the chosen aggregation. Two O(rows) passes over the
 * index array (frequencies, then accumulation) — no row data copied. Rows with a
 * blank value in either dimension are skipped. Returns null when the config is
 * incomplete (no row/column column chosen).
 */
export function computePivot(
  dataset: Dataset,
  order: number[],
  config: PivotConfig,
): PivotResult | null {
  const { rowKey, colKey, aggregation, measureKey } = config;
  if (rowKey == null || colKey == null) return null;

  const rowIdx = dataset.columnIndex[rowKey];
  const colIdx = dataset.columnIndex[colKey];
  if (rowIdx == null || colIdx == null) return null;
  const measIdx = measureKey != null ? dataset.columnIndex[measureKey] : undefined;

  const { rows } = dataset;
  const rowBucket = config.rowBucket === true && dataset.columns[rowIdx].type === 'number';
  const colBucket = config.colBucket === true && dataset.columns[colIdx].type === 'number';

  // Phase 1 — over rows where BOTH dimensions are present, gather either the
  // value frequencies (categorical axis) or the numeric range (bucketed axis).
  const freqRow = new Map<string, number>();
  const freqCol = new Map<string, number>();
  const rng = { rowMin: Infinity, rowMax: -Infinity, colMin: Infinity, colMax: -Infinity };
  for (const r of order) {
    const row = rows[r];
    const rv = row[rowIdx];
    const cv = row[colIdx];
    if (isBlank(rv) || isBlank(cv)) continue;

    if (rowBucket) {
      const n = toNum(rv);
      if (Number.isFinite(n)) {
        if (n < rng.rowMin) rng.rowMin = n;
        if (n > rng.rowMax) rng.rowMax = n;
      }
    } else {
      const rs = String(rv);
      freqRow.set(rs, (freqRow.get(rs) ?? 0) + 1);
    }

    if (colBucket) {
      const n = toNum(cv);
      if (Number.isFinite(n)) {
        if (n < rng.colMin) rng.colMin = n;
        if (n > rng.colMax) rng.colMax = n;
      }
    } else {
      const cs = String(cv);
      freqCol.set(cs, (freqCol.get(cs) ?? 0) + 1);
    }
  }

  const rowAxis = rowBucket
    ? rng.rowMax >= rng.rowMin
      ? bucketedAxis(rng.rowMin, rng.rowMax)
      : EMPTY_AXIS
    : categoricalAxis(freqRow);
  const colAxis = colBucket
    ? rng.colMax >= rng.colMin
      ? bucketedAxis(rng.colMin, rng.colMax)
      : EMPTY_AXIS
    : categoricalAxis(freqCol);
  const nRows = rowAxis.values.length;
  const nCols = colAxis.values.length;

  const cellAcc: Acc[][] = Array.from({ length: nRows }, () =>
    Array.from({ length: nCols }, newAcc),
  );
  const rowAcc: Acc[] = Array.from({ length: nRows }, newAcc);
  const colAcc: Acc[] = Array.from({ length: nCols }, newAcc);
  const grandAcc = newAcc();

  // Phase 2 — accumulate cell / margin totals.
  for (const r of order) {
    const row = rows[r];
    const rv = row[rowIdx];
    const cv = row[colIdx];
    if (isBlank(rv) || isBlank(cv)) continue;
    const ri = rowAxis.indexOf(rv);
    const ci = colAxis.indexOf(cv);
    if (ri === undefined || ci === undefined) continue;

    let n = 0;
    let usable = false;
    if (measIdx != null) {
      const mv = row[measIdx];
      n = typeof mv === 'number' ? mv : Number(mv);
      usable = !isBlank(mv) && !Number.isNaN(n);
    }
    for (const acc of [cellAcc[ri][ci], rowAcc[ri], colAcc[ci], grandAcc]) {
      acc.count += 1;
      if (usable) {
        acc.sum += n;
        acc.numCount += 1;
      }
    }
  }

  let max = 0;
  const cells = cellAcc.map((rowAccs) =>
    rowAccs.map((acc) => {
      const v = reduce(acc, aggregation);
      if (v > max) max = v;
      return v;
    }),
  );

  return {
    rowValues: rowAxis.values,
    colValues: colAxis.values,
    rowHasOthers: rowAxis.hasOthers,
    colHasOthers: colAxis.hasOthers,
    cells,
    rowTotals: rowAcc.map((acc) => reduce(acc, aggregation)),
    colTotals: colAcc.map((acc) => reduce(acc, aggregation)),
    grandTotal: reduce(grandAcc, aggregation),
    max,
    rowBounds: rowAxis.bounds,
    colBounds: colAxis.bounds,
  };
}
