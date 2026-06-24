import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Dataset } from '@/types/dataset';
import type { PivotAggregation } from '@/types/pivot';
import { OTHERS_BUCKET } from '@/types/pivot';
import { cn } from '@/utils/cn';
import { selectCls } from '@/utils/controls';
import { formatNumber as fmt } from '@/utils/formatNumber';
import { computePivot } from '@/lib/pivot/computePivot';
import { categoricalFilter, type NewFilter } from '@/lib/stats/distributionFilter';
import type { UsePivotConfig } from '../hooks/usePivotConfig';

const AGGREGATIONS: { value: PivotAggregation; label: string }[] = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
];

export interface PivotPanelProps {
  dataset: Dataset;
  /** Filtered row indices to cross-tabulate. */
  order: number[];
  /** Pivot config owned by the orchestrator (shared with links + presets). */
  pivot: UsePivotConfig;
  /** When provided, cells become clickable to filter to that row × column. */
  onAddFilter?: (filter: NewFilter) => void;
}

/** brand-500 wash whose opacity tracks the cell's share of the max value. */
function heat(value: number, max: number): CSSProperties {
  if (value <= 0 || max <= 0) return {};
  const t = value / max;
  return {
    backgroundColor: `rgba(99, 102, 241, ${(0.12 + 0.78 * t).toFixed(3)})`,
    color: t > 0.55 ? '#fff' : undefined,
  };
}

const headBtn =
  'flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800';
const corner =
  'sticky left-0 top-0 z-20 bg-slate-50 px-3 py-2 text-left font-semibold dark:bg-slate-800';
const colHead =
  'sticky top-0 z-10 bg-slate-50 px-3 py-2 text-right font-semibold dark:bg-slate-800';
const rowHead =
  'sticky left-0 z-10 max-w-[12rem] truncate bg-white px-3 py-1.5 text-left font-medium text-slate-700 dark:bg-slate-900 dark:text-slate-200';

export function PivotPanel({
  dataset,
  order,
  pivot,
  onAddFilter,
}: PivotPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const { config, numericColumns, setRow, setCol, setAggregation, setMeasure } = pivot;

  // Gate the cross-tab pass on the panel being open — collapsed costs nothing.
  const result = useMemo(
    () => (expanded ? computePivot(dataset, order, config) : null),
    [expanded, dataset, order, config],
  );

  const colType = (key: string | null) =>
    key != null ? dataset.columns[dataset.columnIndex[key]]?.type : undefined;

  const measureDisabled = config.aggregation === 'count';
  const noNumeric = numericColumns.length === 0;
  const measureCol =
    config.measureKey != null
      ? dataset.columns[dataset.columnIndex[config.measureKey]]
      : undefined;
  const valueLabel = measureDisabled
    ? 'Count'
    : `${AGGREGATIONS.find((a) => a.value === config.aggregation)?.label} of ${
        measureCol?.name ?? 'value'
      }`;

  const handleCell = (rowVal: string, colVal: string) => {
    const rt = colType(config.rowKey);
    const ct = colType(config.colKey);
    if (!onAddFilter || config.rowKey == null || config.colKey == null || !rt || !ct) {
      return;
    }
    onAddFilter(categoricalFilter(config.rowKey, rt, rowVal));
    onAddFilter(categoricalFilter(config.colKey, ct, colVal));
  };

  const capped = result != null && (result.rowHasOthers || result.colHasOthers);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className={headBtn}
      >
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Pivot table
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={cn('h-4 w-4 text-slate-400 transition-transform dark:text-slate-500', expanded && 'rotate-180')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Rows
            </label>
            <select
              aria-label="Pivot rows"
              value={config.rowKey ?? ''}
              onChange={(e) => setRow(e.target.value)}
              className={selectCls}
            >
              {dataset.columns.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
            </select>

            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Columns
            </label>
            <select
              aria-label="Pivot columns"
              value={config.colKey ?? ''}
              onChange={(e) => setCol(e.target.value)}
              className={selectCls}
            >
              {dataset.columns.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
            </select>

            <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />

            <select
              aria-label="Pivot aggregation"
              value={config.aggregation}
              onChange={(e) => setAggregation(e.target.value as PivotAggregation)}
              className={selectCls}
            >
              {AGGREGATIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Pivot measure column"
              value={config.measureKey ?? ''}
              onChange={(e) => setMeasure(e.target.value)}
              disabled={measureDisabled || noNumeric}
              className={cn(selectCls, (measureDisabled || noNumeric) && 'opacity-40')}
            >
              {noNumeric ? (
                <option value="">— no numeric columns —</option>
              ) : (
                numericColumns.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {result && result.rowValues.length > 0 ? (
            <>
              <div className="max-h-[50vh] overflow-auto border-t border-slate-100 dark:border-slate-800">
                <table className="text-sm" data-testid="pivot-table">
                  <thead className="text-xs text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className={corner}>{valueLabel}</th>
                      {result.colValues.map((cv) => (
                        <th key={cv} className={colHead}>
                          {cv}
                        </th>
                      ))}
                      <th className={cn(colHead, 'text-brand-700 dark:text-brand-300')}>
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {result.rowValues.map((rv, ri) => {
                      const rowReal = !(result.rowHasOthers && rv === OTHERS_BUCKET);
                      return (
                        <tr key={rv}>
                          <th scope="row" className={rowHead} title={rv}>
                            {rv}
                          </th>
                          {result.colValues.map((cv, ci) => {
                            const value = result.cells[ri][ci];
                            const colReal = !(result.colHasOthers && cv === OTHERS_BUCKET);
                            const clickable = Boolean(onAddFilter) && rowReal && colReal && value > 0;
                            return (
                              <td
                                key={cv}
                                style={heat(value, result.max)}
                                className="p-0 text-right font-mono tabular-nums"
                              >
                                {clickable ? (
                                  <button
                                    type="button"
                                    onClick={() => handleCell(rv, cv)}
                                    aria-label={`Filter ${rv} × ${cv}`}
                                    className="block w-full px-3 py-1.5 text-right hover:ring-2 hover:ring-inset hover:ring-brand-500"
                                  >
                                    {fmt(value)}
                                  </button>
                                ) : (
                                  <span className="block px-3 py-1.5 text-slate-300 dark:text-slate-600">
                                    {value > 0 ? fmt(value) : ''}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-1.5 text-right font-mono font-semibold tabular-nums text-brand-700 dark:text-brand-300">
                            {fmt(result.rowTotals[ri])}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 dark:border-slate-700">
                      <th className={cn(rowHead, 'font-semibold text-brand-700 dark:text-brand-300')}>
                        Total
                      </th>
                      {result.colTotals.map((t, ci) => (
                        <td
                          key={result.colValues[ci]}
                          className="px-3 py-1.5 text-right font-mono font-semibold tabular-nums text-brand-700 dark:text-brand-300"
                        >
                          {fmt(t)}
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-right font-mono font-bold tabular-nums text-brand-700 dark:text-brand-300">
                        {fmt(result.grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="px-4 py-2 text-[11px] text-slate-400 dark:text-slate-500">
                {capped && 'Top 20 values per axis; the rest are grouped as (others). '}
                {onAddFilter && 'Click a cell to filter to that row × column.'}
              </p>
            </>
          ) : (
            <p className="border-t border-slate-100 px-4 py-6 text-center text-sm text-slate-400 dark:border-slate-800 dark:text-slate-500">
              No rows with both dimensions present.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
