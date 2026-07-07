import type { Dataset, LogRow } from '@/types/dataset';
import { coerceValue } from './assembleDataset';

/** Hard row cap mirroring the ingest path — protects the browser's memory. */
export const MAX_ROWS = 500_000;

export interface AppendResult {
  dataset: Dataset;
  /** True when the hard cap was hit and some appended rows were dropped. */
  truncated: boolean;
  /** How many oldest rows were evicted by the ring-buffer window (0 if none). */
  evicted: number;
}

function coerceRow(raw: string[], columns: Dataset['columns']): LogRow {
  const row: LogRow = new Array(columns.length);
  for (let c = 0; c < columns.length; c++) {
    row[c] = coerceValue(raw[c], columns[c].type);
  }
  return row;
}

/**
 * Appends raw string rows to a dataset, coercing them against the **existing**
 * schema (never re-inferred). Returns a new Dataset object (fresh `rows` array +
 * bumped `rowCount`) so React re-renders and the index pipeline re-derives over
 * the grown data. Used by live tailing.
 *
 * Two modes:
 * - Default: stop at `cap`, dropping overflowing **new** rows (`truncated`).
 * - Ring buffer (`keepLast` set): always accept new rows, evicting the **oldest**
 *   beyond the window (`evicted`) so a long-running tail stays memory-bounded.
 */
export function appendRows(
  dataset: Dataset,
  rawRows: string[][],
  cap = MAX_ROWS,
  keepLast?: number,
): AppendResult {
  const { columns } = dataset;

  if (keepLast != null) {
    // Ring buffer: never refuse new rows, drop the oldest beyond the window.
    let rows: LogRow[] = dataset.rows.slice();
    for (const raw of rawRows) rows.push(coerceRow(raw, columns));

    let evicted = 0;
    if (rows.length > keepLast) {
      evicted = rows.length - keepLast;
      rows = rows.slice(evicted);
    }
    return {
      dataset: { ...dataset, rows, meta: { ...dataset.meta, rowCount: rows.length } },
      truncated: false,
      evicted,
    };
  }

  const room = cap - dataset.rows.length;
  if (room <= 0) return { dataset, truncated: true, evicted: 0 };

  const toAdd = rawRows.length > room ? rawRows.slice(0, room) : rawRows;
  const truncated = toAdd.length < rawRows.length;

  const rows: LogRow[] = dataset.rows.slice();
  for (const raw of toAdd) rows.push(coerceRow(raw, columns));

  return {
    dataset: {
      ...dataset,
      rows,
      meta: {
        ...dataset.meta,
        rowCount: rows.length,
        truncated: dataset.meta.truncated || truncated,
      },
    },
    truncated,
    evicted: 0,
  };
}
