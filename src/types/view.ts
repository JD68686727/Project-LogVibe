import type { ChartConfig } from './chart';
import type { ColumnFilter } from './filter';
import type { PivotConfig } from './pivot';
import type { ColumnViewItem } from './table';

/**
 * A persisted "view" — a named snapshot of the filter + chart + column
 * configuration. Deliberately stores only configuration, never row data: the
 * local-first model keeps users' data in memory only, never on disk.
 */
export interface SavedView {
  id: string;
  name: string;
  /** Schema fingerprint (column keys + types) this view applies to. */
  datasetSignature: string;
  filters: ColumnFilter[];
  chart: ChartConfig;
  /** Column visibility + order. Optional for back-compat with older saved views. */
  columns?: ColumnViewItem[];
  /** Pivot cross-tab config. Optional for back-compat with older saved views. */
  pivot?: PivotConfig;
  createdAt: number;
}
