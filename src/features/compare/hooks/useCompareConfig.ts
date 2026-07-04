import { useCallback, useMemo, useState } from 'react';
import type { ColumnSchema, Dataset } from '@/types/dataset';
import type { Aggregation, DateBucket } from '@/types/chart';
import type { ColumnFilter } from '@/types/filter';
import type { CompareChartType, CompareResult } from '@/types/compare';
import type { LoadedFile } from '@/types/workspace';
import { commonColumns, commonNumericColumns } from '@/lib/compare/commonColumns';
import { buildComparison } from '@/lib/compare/buildComparison';
import { applyFilters } from '@/lib/filter/applyFilters';
import { operatorsForType } from '@/lib/filter/operators';
import { seriesColor } from '@/utils/chartColors';
import { DEFAULT_TZ } from '@/lib/time/timezone';

let filterIdCounter = 0;
const nextFilterId = () => `cmpf-${++filterIdCounter}`;

interface ConfigState {
  type: CompareChartType;
  dimensionKey: string;
  measureKey: string | null;
  aggregation: Aggregation;
  bucket: DateBucket;
}

export interface CompareFileItem {
  id: string;
  label: string;
  /** Total rows in the file. */
  rows: number;
  /** Rows after this file's own filters. */
  filteredRows: number;
  included: boolean;
  /** Series colour when included; undefined when excluded. */
  color?: string;
  /** This file's dataset, for rendering its filter editor. */
  dataset: Dataset;
  filters: ColumnFilter[];
  /** Time-sync offset (seconds) applied to this file's date dimension. */
  offsetSeconds: number;
}

export interface UseCompareConfig {
  files: CompareFileItem[];
  toggleFile: (id: string) => void;
  addFileFilter: (fileId: string) => void;
  updateFileFilter: (
    fileId: string,
    filterId: string,
    patch: Partial<ColumnFilter>,
  ) => void;
  removeFileFilter: (fileId: string, filterId: string) => void;
  /** Sets a file's time-sync offset in seconds (may be negative). */
  setFileOffset: (fileId: string, seconds: number) => void;
  commonCols: ColumnSchema[];
  commonNumeric: ColumnSchema[];
  config: ConfigState;
  dimensionIsDate: boolean;
  includedCount: number;
  setType: (type: CompareChartType) => void;
  setDimension: (key: string) => void;
  setMeasure: (key: string) => void;
  setAggregation: (agg: Aggregation) => void;
  setBucket: (bucket: DateBucket) => void;
  result: CompareResult;
}

/** Unique, stable display labels (file name; de-duplicated by suffix). */
function buildLabels(files: LoadedFile[]): Map<string, string> {
  const seen = new Map<string, number>();
  const out = new Map<string, string>();
  for (const f of files) {
    const base = f.dataset.meta.fileName;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    out.set(f.id, n === 1 ? base : `${base} (${n})`);
  }
  return out;
}

export function useCompareConfig(
  files: LoadedFile[],
  tz: string = DEFAULT_TZ,
): UseCompareConfig {
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [filtersByFile, setFiltersByFile] = useState<
    Record<string, ColumnFilter[]>
  >({});
  const [offsetByFile, setOffsetByFile] = useState<Record<string, number>>({});
  const [cfg, setCfg] = useState<ConfigState>({
    type: 'bar',
    dimensionKey: '',
    measureKey: null,
    aggregation: 'count',
    bucket: 'none',
  });

  const labels = useMemo(() => buildLabels(files), [files]);
  const included = useMemo(
    () => files.filter((f) => !excluded.has(f.id)),
    [files, excluded],
  );

  // Each file's per-file filtered row indices.
  const orderById = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const f of files) {
      map.set(f.id, applyFilters(f.dataset, filtersByFile[f.id] ?? []));
    }
    return map;
  }, [files, filtersByFile]);

  const commonCols = useMemo(
    () => commonColumns(included.map((f) => f.dataset)),
    [included],
  );
  const commonNumeric = useMemo(
    () => commonNumericColumns(included.map((f) => f.dataset)),
    [included],
  );

  // Resolve effective keys so stale selections (after toggling files) never
  // point at a column that isn't shared by the current selection.
  const dimensionKey = commonCols.some((c) => c.key === cfg.dimensionKey)
    ? cfg.dimensionKey
    : (commonCols[0]?.key ?? '');
  const dimensionIsDate =
    commonCols.find((c) => c.key === dimensionKey)?.type === 'date';
  const measureKey =
    cfg.aggregation === 'count'
      ? null
      : commonNumeric.some((c) => c.key === cfg.measureKey)
        ? cfg.measureKey
        : (commonNumeric[0]?.key ?? null);

  const effectiveConfig: ConfigState = {
    type: cfg.type,
    dimensionKey,
    measureKey,
    aggregation: cfg.aggregation,
    bucket: cfg.bucket,
  };

  const colorById = new Map<string, string>();
  included.forEach((f, i) => colorById.set(f.id, seriesColor(i)));

  const fileItems: CompareFileItem[] = files.map((f) => ({
    id: f.id,
    label: labels.get(f.id) ?? f.dataset.meta.fileName,
    rows: f.dataset.rows.length,
    filteredRows: orderById.get(f.id)?.length ?? f.dataset.rows.length,
    included: !excluded.has(f.id),
    color: colorById.get(f.id),
    dataset: f.dataset,
    filters: filtersByFile[f.id] ?? [],
    offsetSeconds: offsetByFile[f.id] ?? 0,
  }));

  const result = useMemo<CompareResult>(() => {
    if (included.length === 0 || dimensionKey === '') {
      return { data: [], seriesLabels: [], groupCount: 0 };
    }
    return buildComparison(
      included.map((f) => ({
        label: labels.get(f.id) ?? f.dataset.meta.fileName,
        dataset: f.dataset,
        order: orderById.get(f.id) ?? [],
        offsetMs: (offsetByFile[f.id] ?? 0) * 1000,
      })),
      { ...effectiveConfig, fileIds: included.map((f) => f.id) },
      tz,
    );
    // effectiveConfig is derived from the listed primitives; orderById carries
    // the per-file filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    included,
    labels,
    orderById,
    offsetByFile,
    tz,
    dimensionKey,
    measureKey,
    cfg.type,
    cfg.aggregation,
    cfg.bucket,
  ]);

  const toggleFile = useCallback((id: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const addFileFilter = useCallback(
    (fileId: string) => {
      const file = files.find((f) => f.id === fileId);
      if (!file || file.dataset.columns.length === 0) return;
      const col = file.dataset.columns[0];
      const op = operatorsForType(col.type)[0]?.value ?? 'isNotEmpty';
      setFiltersByFile((prev) => ({
        ...prev,
        [fileId]: [
          ...(prev[fileId] ?? []),
          { id: nextFilterId(), columnKey: col.key, operator: op, value: '' },
        ],
      }));
    },
    [files],
  );

  const updateFileFilter = useCallback(
    (fileId: string, filterId: string, patch: Partial<ColumnFilter>) => {
      setFiltersByFile((prev) => ({
        ...prev,
        [fileId]: (prev[fileId] ?? []).map((f) =>
          f.id === filterId ? { ...f, ...patch } : f,
        ),
      }));
    },
    [],
  );

  const removeFileFilter = useCallback((fileId: string, filterId: string) => {
    setFiltersByFile((prev) => ({
      ...prev,
      [fileId]: (prev[fileId] ?? []).filter((f) => f.id !== filterId),
    }));
  }, []);

  const setFileOffset = useCallback((fileId: string, seconds: number) => {
    setOffsetByFile((prev) => ({ ...prev, [fileId]: seconds }));
  }, []);

  const setType = useCallback(
    (type: CompareChartType) => setCfg((p) => ({ ...p, type })),
    [],
  );
  const setDimension = useCallback(
    (key: string) => setCfg((p) => ({ ...p, dimensionKey: key })),
    [],
  );
  const setMeasure = useCallback(
    (key: string) => setCfg((p) => ({ ...p, measureKey: key })),
    [],
  );
  const setAggregation = useCallback(
    (aggregation: Aggregation) => setCfg((p) => ({ ...p, aggregation })),
    [],
  );
  const setBucket = useCallback(
    (bucket: DateBucket) => setCfg((p) => ({ ...p, bucket })),
    [],
  );

  return {
    files: fileItems,
    toggleFile,
    addFileFilter,
    updateFileFilter,
    removeFileFilter,
    setFileOffset,
    commonCols,
    commonNumeric,
    config: effectiveConfig,
    dimensionIsDate,
    includedCount: included.length,
    setType,
    setDimension,
    setMeasure,
    setAggregation,
    setBucket,
    result,
  };
}
