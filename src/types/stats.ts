import type { ColumnType } from './dataset';

export interface NumericStats {
  min: number;
  max: number;
  mean: number;
  sum: number;
}

export interface ColumnStats {
  key: string;
  name: string;
  type: ColumnType;
  /** Non-null, non-empty cell count. */
  count: number;
  nullCount: number;
  distinctCount: number;
  /** True when distinct tracking hit its cap (so distinctCount is a floor). */
  distinctCapped: boolean;
  /** Present only for numeric columns with at least one parseable value. */
  numeric: NumericStats | null;
}
