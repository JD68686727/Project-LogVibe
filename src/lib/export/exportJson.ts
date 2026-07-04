import type { CellValue, ColumnSchema, Dataset } from '@/types/dataset';
import { formatTimestamp } from '@/lib/time/timezone';

/**
 * Serializes the rows referenced by `order` (the current filtered + sorted
 * display order) to a pretty-printed JSON array of objects, keyed by column
 * name and limited to `columns` (defaults to all) — so the export mirrors the
 * visible table. null cells stay JSON `null`. Operating through the index array
 * means only the exported view is materialized.
 */
export function datasetToJson(
  dataset: Dataset,
  order: number[],
  columns: ColumnSchema[] = dataset.columns,
  redact?: (cell: CellValue) => CellValue,
  tz?: string,
): string {
  const data = order.map((rowIdx) => {
    const row = dataset.rows[rowIdx];
    const obj: Record<string, CellValue> = {};
    for (const c of columns) {
      let cell = row[dataset.columnIndex[c.key]];
      if (tz && c.type === 'date' && cell != null) {
        cell = formatTimestamp(String(cell), tz);
      }
      obj[c.name] = redact ? redact(cell) : cell;
    }
    return obj;
  });
  return JSON.stringify(data, null, 2);
}
