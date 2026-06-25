/** Cross-tabulation (pivot) of two columns over the filtered rows. */

export type PivotAggregation = 'count' | 'sum' | 'avg';

export interface PivotConfig {
  /** Column whose values become the grid rows. */
  rowKey: string | null;
  /** Column whose values become the grid columns. */
  colKey: string | null;
  aggregation: PivotAggregation;
  /** Numeric column to aggregate; required (and only used) for sum / avg. */
  measureKey: string | null;
  /** Bucket a numeric row axis into ranges instead of distinct values. */
  rowBucket?: boolean;
  /** Bucket a numeric column axis into ranges instead of distinct values. */
  colBucket?: boolean;
}

export interface PivotResult {
  /** Row header values; a trailing `(others)` bucket when capped. */
  rowValues: string[];
  /** Column header values; a trailing `(others)` bucket when capped. */
  colValues: string[];
  rowHasOthers: boolean;
  colHasOthers: boolean;
  /** Aggregated value per cell, indexed `[row][col]`. */
  cells: number[][];
  rowTotals: number[];
  colTotals: number[];
  grandTotal: number;
  /** Largest single cell value, used to scale the heatmap shading. */
  max: number;
  /** Per-row-value [lo, hi] bounds when the row axis is bucketed, else null. */
  rowBounds: [number, number][] | null;
  /** Per-col-value [lo, hi] bounds when the column axis is bucketed, else null. */
  colBounds: [number, number][] | null;
}

/** Synthetic bucket label for values beyond the per-axis cap. Not filterable. */
export const OTHERS_BUCKET = '(others)';
