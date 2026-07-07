import type { ColumnSchema, ColumnType, Dataset } from '@/types/dataset';
import { coerceValue } from '@/lib/csv/assembleDataset';

/**
 * A recipe for a computed column: pull a value out of an existing column with a
 * regex and coerce it to a type. Pure data so it can be snapshotted/replayed.
 */
export interface DerivedSpec {
  /** Header label for the new column. */
  name: string;
  /** Key of the source column to read from. */
  sourceKey: string;
  /** Regex source; matched against the source cell's string form. */
  pattern: string;
  /** Regex flags (e.g. "i"). */
  flags?: string;
  /** Capture group to take (0 = whole match). Defaults to 1. */
  group?: number;
  /** Type to coerce the extracted text to. Defaults to 'string'. */
  type?: ColumnType;
}

/** Slugifies a name into a stable key, de-duped against existing keys. */
function uniqueKey(name: string, taken: Record<string, number>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'column';
  if (taken[base] == null) return base;
  let n = 2;
  while (taken[`${base}_${n}`] != null) n++;
  return `${base}_${n}`;
}

/**
 * Returns a new Dataset with an extra column computed by regex-extracting from a
 * source column. Each row's source cell is read as a string, matched, and the
 * chosen capture group coerced to the target type (no match → null). Immutable,
 * mirroring `retypeColumn`. Throws on an invalid regex (caller guards the UI).
 */
export function deriveColumn(dataset: Dataset, spec: DerivedSpec): Dataset {
  const srcIdx = dataset.columnIndex[spec.sourceKey];
  if (srcIdx == null) return dataset;

  const re = new RegExp(spec.pattern, spec.flags);
  const group = spec.group ?? 1;
  const type = spec.type ?? 'string';
  const key = uniqueKey(spec.name, dataset.columnIndex);

  const column: ColumnSchema = { name: spec.name, key, type, derived: true };
  const columns = [...dataset.columns, column];
  const columnIndex = { ...dataset.columnIndex, [key]: columns.length - 1 };

  const rows = dataset.rows.map((row) => {
    const cell = row[srcIdx];
    const match = cell == null ? null : String(cell).match(re);
    const extracted = match ? match[group] : undefined;
    return [...row, coerceValue(extracted, type)];
  });

  return { ...dataset, columns, columnIndex, rows };
}

/**
 * Returns a new Dataset with a column removed (used to undo a derived column):
 * drops its schema entry + each row's cell and rebuilds the index. No-op for an
 * unknown key.
 */
export function dropColumn(dataset: Dataset, key: string): Dataset {
  const idx = dataset.columnIndex[key];
  if (idx == null) return dataset;

  const columns = dataset.columns.filter((_, i) => i !== idx);
  const columnIndex: Record<string, number> = {};
  columns.forEach((c, i) => {
    columnIndex[c.key] = i;
  });
  const rows = dataset.rows.map((row) => row.filter((_, i) => i !== idx));

  return { ...dataset, columns, columnIndex, rows };
}
