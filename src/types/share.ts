import type { ChartConfig } from './chart';
import type { FilterGroup } from './filter';
import type { PivotConfig } from './pivot';
import type { ColumnViewItem, SortKey } from './table';
import type { DerivedSpec } from '@/lib/table/deriveColumn';

/**
 * The full analyze-view configuration that a shareable link carries. Like saved
 * views, this is configuration only — never row data. A recipient loads their
 * own file and gets your filters / search / sort / chart / columns applied.
 */
export interface ViewState {
  /** Condition groups (AND within, OR between). */
  groups: FilterGroup[];
  query: string;
  /** Treat `query` as a regular expression. Optional for back-compat. */
  searchRegex?: boolean;
  /** Multi-column sort, primary first. */
  sort: SortKey[];
  chart: ChartConfig;
  columns: ColumnViewItem[];
  /** Pivot cross-tab config. Optional for back-compat with pre-pivot links. */
  pivot?: PivotConfig;
  /** Computed-column recipes (regex/math/concat) to recreate on the recipient's
   *  file. Config only — no row data. Optional for back-compat. */
  derived?: DerivedSpec[];
}
