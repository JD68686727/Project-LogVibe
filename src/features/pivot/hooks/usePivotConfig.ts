import { useCallback, useMemo, useState } from 'react';
import type { ColumnSchema, Dataset } from '@/types/dataset';
import type { PivotAggregation, PivotConfig } from '@/types/pivot';

export function defaultPivotConfig(dataset: Dataset): PivotConfig {
  const cols = dataset.columns;
  return {
    rowKey: cols[0]?.key ?? null,
    colKey: (cols[1] ?? cols[0])?.key ?? null,
    aggregation: 'count',
    measureKey: null,
  };
}

export interface UsePivotConfig {
  config: PivotConfig;
  /** Columns eligible to be a measure (numeric only). */
  numericColumns: ColumnSchema[];
  setRow: (key: string) => void;
  setCol: (key: string) => void;
  setAggregation: (agg: PivotAggregation) => void;
  setMeasure: (key: string) => void;
  /** Replaces the whole config (applying a shared link or saved view). */
  applyConfig: (config: PivotConfig) => void;
}

/**
 * Owns pivot-table config so the orchestrator can snapshot/restore it (shared
 * links, saved views), mirroring `useChartConfig`. The cross-tab itself is
 * derived in `PivotPanel`, gated on the panel being expanded.
 */
export function usePivotConfig(dataset: Dataset): UsePivotConfig {
  const numericColumns = useMemo(
    () => dataset.columns.filter((c) => c.type === 'number'),
    [dataset],
  );

  const [config, setConfig] = useState<PivotConfig>(() => defaultPivotConfig(dataset));

  const setRow = useCallback(
    (rowKey: string) => setConfig((p) => ({ ...p, rowKey })),
    [],
  );
  const setCol = useCallback(
    (colKey: string) => setConfig((p) => ({ ...p, colKey })),
    [],
  );
  const setMeasure = useCallback(
    (measureKey: string) => setConfig((p) => ({ ...p, measureKey })),
    [],
  );
  const setAggregation = useCallback(
    (aggregation: PivotAggregation) =>
      setConfig((p) => {
        // count needs no measure; sum/avg need a numeric one — auto-pick if unset.
        if (aggregation === 'count') return { ...p, aggregation };
        const measureKey = p.measureKey ?? numericColumns[0]?.key ?? null;
        return { ...p, aggregation, measureKey };
      }),
    [numericColumns],
  );

  const applyConfig = useCallback((next: PivotConfig) => setConfig(next), []);

  return { config, numericColumns, setRow, setCol, setAggregation, setMeasure, applyConfig };
}
