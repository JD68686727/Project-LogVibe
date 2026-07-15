import type { Aggregation, DateBucket } from '@/types/chart';
import type { CompareChartType } from '@/types/compare';
import type { LoadedFile } from '@/types/workspace';
import { cn } from '@/utils/cn';
import { selectCls } from '@/utils/controls';
import { DEFAULT_TZ } from '@/lib/time/timezone';
import { formatInt } from '@/utils/formatNumber';
import { useI18n } from '@/lib/i18n/I18nContext';
import type { TKey } from '@/lib/i18n/translations';
import { useCompareConfig } from '../hooks/useCompareConfig';
import { CompareChart } from './CompareChart';
import { CompareDiff } from './CompareDiff';
import { CompareFileRow } from './CompareFileRow';

const CHART_TYPES: { value: CompareChartType; label: TKey }[] = [
  { value: 'bar', label: 'chart.type.bar' },
  { value: 'line', label: 'chart.type.line' },
];

const AGGREGATIONS: { value: Aggregation; label: TKey }[] = [
  { value: 'count', label: 'agg.count' },
  { value: 'sum', label: 'agg.sum' },
  { value: 'avg', label: 'agg.avg' },
  { value: 'min', label: 'agg.min' },
  { value: 'max', label: 'agg.max' },
];

const BUCKETS: { value: DateBucket; label: TKey }[] = [
  { value: 'none', label: 'chart.bucket.none' },
  { value: 'hour', label: 'chart.bucket.hour' },
  { value: 'day', label: 'chart.bucket.day' },
  { value: 'week', label: 'chart.bucket.week' },
  { value: 'month', label: 'chart.bucket.month' },
];

export interface CompareViewProps {
  files: LoadedFile[];
  /** Display timezone for date buckets (default UTC). */
  timeZone?: string;
}

export function CompareView({ files, timeZone = DEFAULT_TZ }: CompareViewProps) {
  const { t } = useI18n();
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
          {t('compare.addSecond')}
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          {t('compare.addHint')}
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
            {t('compare.files')}
          </span>
          {showOffset && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {t('compare.timesync')}
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
          {t('compare.noCommon')}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
              {CHART_TYPES.map((ct) => (
                <button
                  key={ct.value}
                  type="button"
                  onClick={() => setType(ct.value)}
                  className={cn(
                    'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                    config.type === ct.value
                      ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-300'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
                  )}
                >
                  {t(ct.label)}
                </button>
              ))}
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('chart.groupBy')}
              </label>
              <select
                aria-label={t('chart.groupByAria')}
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
                  aria-label={t('chart.dateBucket')}
                  value={config.bucket}
                  onChange={(e) => setBucket(e.target.value as DateBucket)}
                  className={selectCls}
                >
                  {BUCKETS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {t(b.label)}
                    </option>
                  ))}
                </select>
              )}

              <select
                aria-label={t('chart.aggregation')}
                value={config.aggregation}
                onChange={(e) => setAggregation(e.target.value as Aggregation)}
                className={selectCls}
              >
                {AGGREGATIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {t(a.label)}
                  </option>
                ))}
              </select>

              <select
                aria-label={t('chart.measure')}
                value={config.measureKey ?? ''}
                onChange={(e) => setMeasure(e.target.value)}
                disabled={measureDisabled || noNumeric}
                className={cn(
                  selectCls,
                  (measureDisabled || noNumeric) && 'opacity-40',
                )}
              >
                {noNumeric ? (
                  <option value="">{t('compare.noSharedNumeric')}</option>
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
              {t('compare.selectOne')}
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
              {t('compare.truncated', {
                n: result.data.length,
                total: formatInt(result.groupCount),
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
