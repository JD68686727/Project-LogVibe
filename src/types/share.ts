import type { ChartConfig } from './chart';
import type { FilterGroup } from './filter';
import type { PivotConfig } from './pivot';
import type { ColumnViewItem, SortKey } from './table';

/**
 * The full analyze-view configuration that a shareable link carries. Like saved
 * views, this is configuration only — never row data. A recipient loads their
 * own file and gets your filters / search / sort / chart / columns applied.
 */
export interface ViewState {
  /** Condition groups (AND within, OR between). */
  groups: FilterGroup[];
  query: string;
  /** Multi-column sort, primary first. */
  sort: SortKey[];
  chart: ChartConfig;
  columns: ColumnViewItem[];
  /** Pivot cross-tab config. Optional for back-compat with pre-pivot links. */
  pivot?: PivotConfig;
}
