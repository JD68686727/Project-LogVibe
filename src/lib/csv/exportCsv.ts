import Papa from 'papaparse';
import type { CellValue, ColumnSchema, Dataset } from '@/types/dataset';
import { formatTimestamp } from '@/lib/time/timezone';

/** Papa.unparse stringifies primitives and renders null/'' as empty fields. */
function cellToField(cell: CellValue): string | number | boolean {
  return cell == null ? '' : cell;
}

/**
 * Serializes the rows referenced by `order` (the current filtered + sorted
 * display order) to CSV. `columns` controls which columns and in what order
 * (defaults to all) — so the export mirrors the visible table. PapaParse handles
 * quoting/escaping; operating through the index array means only the exported
 * view is materialized.
 */
export function datasetToCsv(
  dataset: Dataset,
  order: number[],
  columns: ColumnSchema[] = dataset.columns,
  redact?: (cell: CellValue) => CellValue,
  tz?: string,
): string {
  const fields = columns.map((c) => c.name);
  const data = order.map((rowIdx) => {
    const row = dataset.rows[rowIdx];
    return columns.map((c) => {
      let cell = row[dataset.columnIndex[c.key]];
      if (tz && c.type === 'date' && cell != null) {
        cell = formatTimestamp(String(cell), tz);
      }
      return cellToField(redact ? redact(cell) : cell);
    });
  });
  return Papa.unparse({ fields, data });
}
