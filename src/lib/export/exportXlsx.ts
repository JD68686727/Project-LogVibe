import type { CellValue, ColumnSchema, Dataset } from '@/types/dataset';
import { formatTimestamp } from '@/lib/time/timezone';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** SheetJS keeps null as a blank cell; primitives pass through typed. */
function cell(c: CellValue): string | number | boolean | null {
  return c == null ? null : c;
}

/**
 * Builds a real `.xlsx` workbook (single "Data" sheet) from the rows referenced
 * by `order`, mirroring the visible columns + order, and returns it as a Blob
 * ready to download. SheetJS is imported **dynamically** so it lands in its own
 * lazy chunk — the library is fetched only when a user actually exports to Excel,
 * keeping the main bundle lean.
 */
export async function datasetToXlsxBlob(
  dataset: Dataset,
  order: number[],
  columns: ColumnSchema[] = dataset.columns,
  redact?: (cell: CellValue) => CellValue,
  tz?: string,
): Promise<Blob> {
  const { utils, write } = await import('xlsx');

  const aoa: (string | number | boolean | null)[][] = [
    columns.map((c) => c.name),
  ];
  for (const rowIdx of order) {
    const row = dataset.rows[rowIdx];
    aoa.push(
      columns.map((c) => {
        let v = row[dataset.columnIndex[c.key]];
        if (tz && c.type === 'date' && v != null) {
          v = formatTimestamp(String(v), tz);
        }
        return cell(redact ? redact(v) : v);
      }),
    );
  }

  const worksheet = utils.aoa_to_sheet(aoa);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, 'Data');

  const buffer = write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Blob([buffer], { type: XLSX_MIME });
}
