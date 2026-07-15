import Papa from 'papaparse';
import type { CellValue, ColumnSchema, Dataset } from '@/types/dataset';
import { formatTimestamp } from '@/lib/time/timezone';

/** Papa.unparse stringifies primitives and renders null/'' as empty fields. */
function cellToField(cell: CellValue): string | number | boolean {
  return cell == null ? '' : cell;
}

/** Leading chars a spreadsheet (Excel/LibreOffice) treats as a formula. */
const FORMULA_START = /^[=@\t\r]/;
const SIGN_START = /^[+-]/;

/**
 * Neutralizes CSV-injection: a cell whose text would be evaluated as a formula
 * when the export is opened in a spreadsheet gets a leading `'` (the standard
 * "treat as text" marker). `-5` / `+3.2` are left intact — a plain signed number
 * isn't a formula — so only real payloads (`=cmd`, `@cmd`, `-2+cmd|…`) are escaped.
 * Log data is attacker-influenced, so this matters for a defensive tool.
 */
function guardFormula(value: string | number | boolean): string | number | boolean {
  if (typeof value !== 'string' || value === '') return value;
  const dangerous =
    FORMULA_START.test(value) ||
    (SIGN_START.test(value) && !Number.isFinite(Number(value)));
  return dangerous ? `'${value}` : value;
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
      return guardFormula(cellToField(redact ? redact(cell) : cell));
    });
  });
  return Papa.unparse({ fields, data });
}
