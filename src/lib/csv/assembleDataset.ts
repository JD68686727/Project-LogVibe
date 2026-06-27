import type { CellValue, ColumnSchema, Dataset, LogRow } from '@/types/dataset';
import { inferSchema } from './inferSchema';

/** Coerces a raw string cell to a typed CellValue based on the column schema. */
function coerce(raw: string | undefined, column: ColumnSchema): CellValue {
  if (raw == null || raw === '') return null;
  switch (column.type) {
    case 'number': {
      const n = Number(raw);
      return Number.isNaN(n) ? raw : n;
    }
    case 'boolean': {
      const v = raw.toLowerCase();
      if (v === 'true' || v === 'yes') return true;
      if (v === 'false' || v === 'no') return false;
      return raw;
    }
    default:
      // Keep strings & dates as raw strings; parse lazily downstream.
      return raw;
  }
}

function buildColumnIndex(columns: ColumnSchema[]): Record<string, number> {
  const index: Record<string, number> = {};
  columns.forEach((c, i) => {
    index[c.key] = i;
  });
  return index;
}

export interface DatasetMetaInput {
  fileName: string;
  fileSize: number;
  delimiter: string;
  truncated: boolean;
}

/**
 * Builds a typed Dataset from parsed headers + raw string rows — the shared tail
 * of every ingestion path (CSV via PapaParse, and the custom-log regex parser).
 * Infers a type per column, then runs a single coercion pass. Pre-allocating the
 * rows array avoids repeated reallocation as it grows on large files.
 */
export function assembleDataset(
  headers: string[],
  rawRows: string[][],
  meta: DatasetMetaInput,
): Dataset {
  const columns = inferSchema(headers, rawRows);
  const columnIndex = buildColumnIndex(columns);

  const rows: LogRow[] = new Array(rawRows.length);
  for (let r = 0; r < rawRows.length; r++) {
    const raw = rawRows[r];
    const row: LogRow = new Array(columns.length);
    for (let c = 0; c < columns.length; c++) {
      row[c] = coerce(raw[c], columns[c]);
    }
    rows[r] = row;
  }

  return {
    columns,
    rows,
    columnIndex,
    meta: {
      fileName: meta.fileName,
      fileSize: meta.fileSize,
      rowCount: rows.length,
      delimiter: meta.delimiter,
      truncated: meta.truncated,
    },
  };
}
