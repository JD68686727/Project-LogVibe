/**
 * Core domain contract for LogVibe. Every feature (ingestion, table, filtering,
 * visualization) reads from these shared types — they are the single source of
 * truth for how a parsed dataset is shaped.
 */

/** Primitive cell value after parsing. We keep raw strings + an inferred type
 *  rather than coercing eagerly — coercion is deferred to filters/charts so we
 *  don't pay the cost on 50k+ rows up front. */
export type CellValue = string | number | boolean | null;

export type ColumnType = 'string' | 'number' | 'boolean' | 'date';

export interface ColumnSchema {
  /** Original header label from the file. */
  name: string;
  /** Stable key used for indexing (normalized, unique). */
  key: string;
  /** Best-effort inferred type, used for sorting/charting/filter operators. */
  type: ColumnType;
  /** True for user-added computed columns (regex-extract); enables removal. */
  derived?: boolean;
}

/**
 * Row is stored as a flat array aligned to `columns` order rather than an
 * object map. Arrays are ~30-40% lighter in memory and faster to iterate than
 * keyed objects when you have tens of thousands of rows.
 */
export type LogRow = CellValue[];

export interface ParseError {
  /** PapaParse error code or our own classification. */
  code: string;
  message: string;
  /** Row index where the error occurred, if applicable. */
  row?: number;
}

export interface DatasetMeta {
  fileName: string;
  fileSize: number;
  rowCount: number;
  delimiter: string;
  /** True when the file exceeded MAX_ROWS and we stopped early. */
  truncated: boolean;
  /** Detected text encoding (e.g. "utf-8", "utf-16le", "windows-1252"). */
  encoding?: string;
}

export interface Dataset {
  columns: ColumnSchema[];
  rows: LogRow[];
  /** Fast lookup: column key -> array index. Built once on ingest. */
  columnIndex: Record<string, number>;
  meta: DatasetMeta;
}

export type ParseStatus = 'idle' | 'parsing' | 'success' | 'error';

export interface ParseState {
  status: ParseStatus;
  dataset: Dataset | null;
  errors: ParseError[];
  /** 0–100, derived from bytes read during streaming. */
  progress: number;
}
