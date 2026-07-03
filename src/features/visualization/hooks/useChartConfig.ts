import { useCallback, useMemo, useState } from 'react';
import type { ColumnSchema, Dataset } from '@/types/dataset';
import type {
  Aggregation,
  ChartConfig,
  ChartResult,
  ChartType,
  DateBucket,
} from '@/types/chart';
import { aggregate } from '@/lib/chart/aggregate';
import { DEFAULT_TZ } from '@/lib/time/timezone';

function defaultConfig(dataset: Dataset): ChartConfig {
  return {
    type: 'bar',
    dimensionKey: dataset.columns[0]?.key ?? '',
    measureKey: null,
    aggregation: 'count',
    bucket: 'none',
  };
}

export interface UseChartConfig {
  config: ChartConfig;
  /** Columns eligible to be a measure (numeric only). */
  numericColumns: ColumnSchema[];
  result: ChartResult;
  setType: (type: ChartType) => void;
  setDimension: (key: string) => void;
  setMeasure: (key: string) => void;
  setAggregation: (agg: Aggregation) => void;
  setBucket: (bucket: DateBucket) => void;
  /** Replaces the whole config (e.g. applying a saved preset). */
  applyConfig: (config: ChartConfig) => void;
}

export function useChartConfig(
  dataset: Dataset,
  order: number[],
  tz: string = DEFAULT_TZ,
): UseChartConfig {
  const numericColumns = useMemo(
    () => dataset.columns.filter((c) => c.type === 'number'),
    [dataset],
  );

  const [config, setConfig] = useState<ChartConfig>(() => defaultConfig(dataset));

  const setType = useCallback(
    (type: ChartType) => setConfig((p) => ({ ...p, type })),
    [],
  );
  const setDimension = useCallback(
    (dimensionKey: string) => setConfig((p) => ({ ...p, dimensionKey })),
    [],
  );
  const setMeasure = useCallback(
    (measureKey: string) => setConfig((p) => ({ ...p, measureKey })),
    [],
  );

  const setAggregation = useCallback(
    (aggregation: Aggregation) =>
      setConfig((p) => {
        // `count` needs no measure; any other aggregation needs a numeric one,
        // so auto-pick the first numeric column when none is selected yet.
        if (aggregation === 'count') return { ...p, aggregation };
        const measureKey = p.measureKey ?? numericColumns[0]?.key ?? null;
        return { ...p, aggregation, measureKey };
      }),
    [numericColumns],
  );

  const setBucket = useCallback(
    (bucket: DateBucket) => setConfig((p) => ({ ...p, bucket })),
    [],
  );

  const applyConfig = useCallback((next: ChartConfig) => setConfig(next), []);

  const result = useMemo(
    () => aggregate(dataset, order, config, tz),
    [dataset, order, config, tz],
  );

  return {
    config,
    numericColumns,
    result,
    setType,
    setDimension,
    setMeasure,
    setAggregation,
    setBucket,
    applyConfig,
  };
}
