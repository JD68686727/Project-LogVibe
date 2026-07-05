import type { Dataset, LogRow } from '@/types/dataset';
import { coerceValue } from './assembleDataset';

/** Hard row cap mirroring the ingest path — protects the browser's memory. */
export const MAX_ROWS = 500_000;

export interface AppendResult {
  dataset: Dataset;
  /** True when the cap was hit and some appended rows were dropped. */
  truncated: boolean;
}

/**
 * Appends raw string rows to a dataset, coercing them against the **existing**
 * schema (never re-inferred), and stops at `cap`. Returns a new Dataset object
 * (fresh `rows` array + bumped `rowCount`) so React re-renders and the index
 * pipeline re-derives over the grown data. Used by live tailing.
 */
export function appendRows(
  dataset: Dataset,
  rawRows: string[][],
  cap = MAX_ROWS,
): AppendResult {
  const room = cap - dataset.rows.length;
  if (room <= 0) return { dataset, truncated: true };

  const toAdd = rawRows.length > room ? rawRows.slice(0, room) : rawRows;
  const truncated = toAdd.length < rawRows.length;

  const { columns } = dataset;
  const rows: LogRow[] = dataset.rows.slice();
  for (const raw of toAdd) {
    const row: LogRow = new Array(columns.length);
    for (let c = 0; c < columns.length; c++) {
      row[c] = coerceValue(raw[c], columns[c].type);
    }
    rows.push(row);
  }

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
  };
}
