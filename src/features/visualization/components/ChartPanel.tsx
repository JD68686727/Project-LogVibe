import type { Dataset } from '@/types/dataset';
import type { Aggregation, ChartType, DateBucket } from '@/types/chart';
import { cn } from '@/utils/cn';
import { selectCls } from '@/utils/controls';
import { useI18n } from '@/lib/i18n/I18nContext';
import type { TKey } from '@/lib/i18n/translations';
import type { UseChartConfig } from '../hooks/useChartConfig';
import { ChartView } from './ChartView';

const CHART_TYPES: { value: ChartType; label: TKey }[] = [
  { value: 'bar', label: 'chart.type.bar' },
  { value: 'line', label: 'chart.type.line' },
  { value: 'pie', label: 'chart.type.pie' },
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

export interface ChartPanelProps {
  dataset: Dataset;
  /** Chart state owned by the orchestrator (shared with presets). */
  chart: UseChartConfig;
}

export function ChartPanel({ dataset, chart }: ChartPanelProps) {
  const { t } = useI18n();
  const {
    config,
    numericColumns,
    result,
    setType,
    setDimension,
    setMeasure,
    setAggregation,
    setBucket,
  } = chart;

  const measureDisabled = config.aggregation === 'count';
  const noNumeric = numericColumns.length === 0;
  const dimensionIsDate =
    dataset.columns[dataset.columnIndex[config.dimensionKey]]?.type === 'date';
  const measureCol =
    config.measureKey != null
      ? dataset.columns[dataset.columnIndex[config.measureKey]]
      : undefined;
  const aggKey = AGGREGATIONS.find((a) => a.value === config.aggregation)?.label;
  const valueLabel = measureDisabled
    ? t('agg.count')
    : t('chart.valueLabel', {
        agg: aggKey ? t(aggKey) : '',
        name: measureCol?.name ?? t('chart.valueFallback'),
      });

  const truncated = result.data.length < result.groupCount;

  return (
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
            {dataset.columns.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>

          {dimensionIsDate && (
            <select
              aria-label={t('chart.dateBucket')}
              value={config.bucket ?? 'none'}
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
            className={cn(selectCls, (measureDisabled || noNumeric) && 'opacity-40')}
          >
            {noNumeric ? (
              <option value="">{t('chart.noNumeric')}</option>
            ) : (
              numericColumns.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <ChartView type={config.type} data={result.data} valueLabel={valueLabel} />

      {truncated && (
        <p className="mt-2 text-center text-xs text-slate-400 dark:text-slate-500">
          {t('chart.truncated', {
            n: result.data.length,
            total: result.groupCount.toLocaleString(),
          })}
        </p>
      )}
    </div>
  );
}
