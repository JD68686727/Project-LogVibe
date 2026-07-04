import type { Aggregation, DateBucket } from '@/types/chart';
import type { CompareChartType } from '@/types/compare';
import type { LoadedFile } from '@/types/workspace';
import { cn } from '@/utils/cn';
import { selectCls } from '@/utils/controls';
import { DEFAULT_TZ } from '@/lib/time/timezone';
import { useCompareConfig } from '../hooks/useCompareConfig';
import { CompareChart } from './CompareChart';
import { CompareDiff } from './CompareDiff';
import { CompareFileRow } from './CompareFileRow';

const CHART_TYPES: { value: CompareChartType; label: string }[] = [
  { value: 'bar', label: 'Bar' },
  { value: 'line', label: 'Line' },
];

const AGGREGATIONS: { value: Aggregation; label: string }[] = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
];

const BUCKETS: { value: DateBucket; label: string }[] = [
  { value: 'none', label: 'No bucket' },
  { value: 'hour', label: 'By hour' },
  { value: 'day', label: 'By day' },
  { value: 'week', label: 'By week' },
  { value: 'month', label: 'By month' },
];

export interface CompareViewProps {
  files: LoadedFile[];
  /** Display timezone for date buckets (default UTC). */
  timeZone?: string;
}

export function CompareView({ files, timeZone = DEFAULT_TZ }: CompareViewProps) {
  const {
    files: fileItems,
    toggleFile,
    addFileFilter,
    updateFileFilter,
    removeFileFilter,
    setFileOffset,
    commonCols,
    commonNumeric,
    config,
    dimensionIsDate,
    includedCount,
    setType,
    setDimension,
    setMeasure,
    setAggregation,
    setBucket,
    result,
  } = useCompareConfig(files, timeZone);

  // Time-sync offsets only make sense when overlaying a bucketed date axis.
  const showOffset = dimensionIsDate && config.bucket !== 'none';

  if (files.length < 2) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Add a second file to compare
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Use “Add file” above, then compare trends across files here.
        </p>
      </div>
    );
  }

  const noCommon = commonCols.length === 0;
  const measureDisabled = config.aggregation === 'count';
  const noNumeric = commonNumeric.length === 0;
  const truncated = result.data.length < result.groupCount;

  return (
    <div className="space-y-3">
      {/* Files — each with its own filter (compare filtered subsets) */}
      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Files
          </span>
          {showOffset && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Time-sync: shift a file&apos;s timestamps (seconds) to align a clock skew
            </span>
          )}
        </div>
        <div className="space-y-2">
          {fileItems.map((f) => (
            <CompareFileRow
              key={f.id}
              item={f}
              onToggle={toggleFile}
              onAddFilter={addFileFilter}
              onUpdateFilter={updateFileFilter}
              onRemoveFilter={removeFileFilter}
              showOffset={showOffset}
              onOffsetChange={setFileOffset}
            />
          ))}
        </div>
      </div>

      <CompareDiff a={files[0].dataset} b={files[1].dataset} />

      {noCommon ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          The selected files share no common columns to compare on.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
              {CHART_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={cn(
                    'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                    config.type === t.value
                      ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-300'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Group by
              </label>
              <select
                aria-label="Group by column"
                value={config.dimensionKey}
                onChange={(e) => setDimension(e.target.value)}
                className={selectCls}
              >
                {commonCols.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
              </select>

              {dimensionIsDate && (
                <select
                  aria-label="Date bucket"
                  value={config.bucket}
                  onChange={(e) => setBucket(e.target.value as DateBucket)}
                  className={selectCls}
                >
                  {BUCKETS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              )}

              <select
                aria-label="Aggregation"
                value={config.aggregation}
                onChange={(e) => setAggregation(e.target.value as Aggregation)}
                className={selectCls}
              >
                {AGGREGATIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>

              <select
                aria-label="Measure column"
                value={config.measureKey ?? ''}
                onChange={(e) => setMeasure(e.target.value)}
                disabled={measureDisabled || noNumeric}
                className={cn(
                  selectCls,
                  (measureDisabled || noNumeric) && 'opacity-40',
                )}
              >
                {noNumeric ? (
                  <option value="">— no shared numeric columns —</option>
                ) : (
                  commonNumeric.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {includedCount < 1 ? (
            <div className="flex h-72 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
              Select at least one file to chart
            </div>
          ) : (
            <CompareChart
              type={config.type}
              data={result.data}
              seriesLabels={result.seriesLabels}
            />
          )}

          {truncated && (
            <p className="mt-2 text-center text-xs text-slate-400 dark:text-slate-500">
              Showing top {result.data.length} of{' '}
              {result.groupCount.toLocaleString()} categories
            </p>
          )}
        </div>
      )}
    </div>
  );
}
