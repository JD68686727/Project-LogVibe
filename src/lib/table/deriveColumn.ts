import type { CellValue, ColumnSchema, ColumnType, Dataset } from '@/types/dataset';
import { coerceValue } from '@/lib/csv/assembleDataset';

/**
 * A recipe for a computed column. Two kinds share one seam:
 * - `extract` — regex-pull a capture group out of a source column.
 * - `arithmetic` — combine two operands (column or numeric literal) with + - * /.
 * Pure data so it can be snapshotted/replayed.
 */
export type DerivedSpec = ExtractSpec | ArithmeticSpec;

export interface ExtractSpec {
  /** Discriminator; omitted defaults to 'extract' for back-compat. */
  kind?: 'extract';
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

export type ArithmeticOp = '+' | '-' | '*' | '/';

export interface ArithmeticSpec {
  kind: 'arithmetic';
  name: string;
  /** Left operand: a column key or a numeric literal. */
  left: string;
  op: ArithmeticOp;
  /** Right operand: a column key or a numeric literal. */
  right: string;
  /** Type to coerce the result to. Defaults to 'number'. */
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

/** Appends a computed column (schema + per-row cells) immutably. */
function appendColumn(
  dataset: Dataset,
  name: string,
  type: ColumnType,
  cells: CellValue[],
): Dataset {
  const key = uniqueKey(name, dataset.columnIndex);
  const column: ColumnSchema = { name, key, type, derived: true };
  const columns = [...dataset.columns, column];
  const columnIndex = { ...dataset.columnIndex, [key]: columns.length - 1 };
  const rows = dataset.rows.map((row, r) => [...row, cells[r]]);
  return { ...dataset, columns, columnIndex, rows };
}

/**
 * Returns a new Dataset with an extra column computed by regex-extracting from a
 * source column. Each row's source cell is read as a string, matched, and the
 * chosen capture group coerced to the target type (no match → null). Immutable,
 * mirroring `retypeColumn`. Throws on an invalid regex (caller guards the UI).
 */
function deriveExtract(dataset: Dataset, spec: ExtractSpec): Dataset {
  const srcIdx = dataset.columnIndex[spec.sourceKey];
  if (srcIdx == null) return dataset;

  const re = new RegExp(spec.pattern, spec.flags);
  const group = spec.group ?? 1;
  const type = spec.type ?? 'string';

  const cells = dataset.rows.map((row) => {
    const cell = row[srcIdx];
    const match = cell == null ? null : String(cell).match(re);
    const extracted = match ? match[group] : undefined;
    return coerceValue(extracted, type);
  });

  return appendColumn(dataset, spec.name, type, cells);
}

/** Resolves an operand token to a number for a given row (column or literal). */
function operandValue(
  token: string,
  row: CellValue[],
  columnIndex: Record<string, number>,
): number | null {
  const idx = columnIndex[token];
  if (idx != null) {
    const v = row[idx];
    if (v == null) return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(token);
  return Number.isFinite(n) ? n : null;
}

function applyOp(op: ArithmeticOp, a: number, b: number): number | null {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return b === 0 ? null : a / b;
  }
}

/**
 * Returns a new Dataset with an extra column computed by combining two operands
 * (each a column key or a numeric literal) with an arithmetic operator. A row is
 * null when either operand is non-numeric/empty, or on divide-by-zero.
 */
function deriveArithmetic(dataset: Dataset, spec: ArithmeticSpec): Dataset {
  const type = spec.type ?? 'number';
  const cells = dataset.rows.map((row) => {
    const a = operandValue(spec.left, row, dataset.columnIndex);
    const b = operandValue(spec.right, row, dataset.columnIndex);
    if (a == null || b == null) return null;
    const result = applyOp(spec.op, a, b);
    if (result == null) return null;
    return type === 'number' ? result : coerceValue(String(result), type);
  });
  return appendColumn(dataset, spec.name, type, cells);
}

/**
 * Returns a new Dataset with an extra computed column. Dispatches on the spec
 * kind (regex extract or arithmetic). Immutable; a no-op when a referenced
 * source column is missing.
 */
export function deriveColumn(dataset: Dataset, spec: DerivedSpec): Dataset {
  if (spec.kind === 'arithmetic') return deriveArithmetic(dataset, spec);
  return deriveExtract(dataset, spec);
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
