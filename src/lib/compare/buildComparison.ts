import type { Dataset } from '@/types/dataset';
import type { ChartConfig } from '@/types/chart';
import type { CompareConfig, CompareResult, CompareSeriesRow } from '@/types/compare';
import { aggregateToMap } from '@/lib/chart/aggregate';
import { DEFAULT_TZ } from '@/lib/time/timezone';

/** Categories shown in the overlay before truncation. */
const MAX_CATEGORIES = 60;

export interface CompareInput {
  /** Unique series label (the file name, de-duplicated by the caller). */
  label: string;
  dataset: Dataset;
  /** Row indices to aggregate for this file (its per-file filtered subset). */
  order: number[];
  /** Time-sync shift (ms) applied to this file's date dimension before
   *  bucketing, to align a clock skew against the other files. */
  offsetMs?: number;
}

/**
 * Aggregates each file independently by a shared dimension over its own `order`
 * (per-file filtered subset), then aligns the results into one overlay dataset
 * keyed by category — every file becomes a series. Reuses `aggregateToMap` so
 * per-file aggregation matches the single-file chart exactly. Categories are
 * ordered (total-desc for bar, name-asc for line) and capped.
 */
export function buildComparison(
  files: CompareInput[],
  config: CompareConfig,
  tz: string = DEFAULT_TZ,
): CompareResult {
  const chartConfig: ChartConfig = {
    type: config.type,
    dimensionKey: config.dimensionKey,
    measureKey: config.measureKey,
    aggregation: config.aggregation,
    bucket: config.bucket,
  };

  const perFile = files.map((f) => ({
    label: f.label,
    map: aggregateToMap(f.dataset, f.order, chartConfig, tz, f.offsetMs ?? 0),
  }));

  // Union of categories with their cross-file total (used to order bars).
  const totals = new Map<string, number>();
  for (const { map } of perFile) {
    for (const [name, value] of map) {
      totals.set(name, (totals.get(name) ?? 0) + value);
    }
  }

  let names = [...totals.keys()];
  if (config.type === 'line') {
    names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  } else {
    names.sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0));
  }

  const groupCount = names.length;
  names = names.slice(0, MAX_CATEGORIES);

  const data: CompareSeriesRow[] = names.map((name) => {
    const row: CompareSeriesRow = { name };
    for (const { label, map } of perFile) {
      row[label] = map.get(name) ?? 0;
    }
    return row;
  });

  return { data, seriesLabels: perFile.map((p) => p.label), groupCount };
}
