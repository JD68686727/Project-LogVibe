import type { Dataset } from '@/types/dataset';
import type { ChartConfig, ChartDatum, ChartResult, ChartType } from '@/types/chart';
import { bucketDate } from './dateBucket';
import { DEFAULT_TZ } from '@/lib/time/timezone';

/** Max categories rendered per chart type before truncation. */
const CAPS: Record<ChartType, number> = { bar: 40, line: 100, pie: 8 };

/** Group key for rows whose dimension is null/empty. A stable, language-neutral
 *  sentinel — the UI translates it at render (see `chart.empty`). */
export const EMPTY_GROUP = '(empty)';

interface GroupAcc {
  sum: number;
  count: number;
  min: number;
  max: number;
  /** How many rows in the group had a usable numeric measure. */
  numCount: number;
}

function reduceGroup(g: GroupAcc, aggregation: ChartConfig['aggregation']): number {
  switch (aggregation) {
    case 'sum':
      return g.sum;
    case 'avg':
      return g.numCount > 0 ? g.sum / g.numCount : 0;
    case 'min':
      return g.numCount > 0 ? g.min : 0;
    case 'max':
      return g.numCount > 0 ? g.max : 0;
    case 'count':
    default:
      return g.count;
  }
}

/**
 * Groups the rows referenced by `order` by the dimension column and reduces
 * each group to a single value per the chosen aggregation. Returns a raw
 * `category -> value` map (unsorted, uncapped). Single O(rows) pass over the
 * index array — no row data copied. Shared by the single-file chart and the
 * multi-file comparison overlay so their aggregation semantics stay identical.
 */
export function aggregateToMap(
  dataset: Dataset,
  order: number[],
  config: ChartConfig,
  tz: string = DEFAULT_TZ,
  offsetMs = 0,
): Map<string, number> {
  const dimIdx = dataset.columnIndex[config.dimensionKey];
  if (dimIdx == null) return new Map();

  const measIdx =
    config.measureKey != null ? dataset.columnIndex[config.measureKey] : undefined;
  const { rows } = dataset;

  // Bucketing only applies to date dimensions; older presets may omit `bucket`.
  const bucket = config.bucket ?? 'none';
  const useBucket = dataset.columns[dimIdx].type === 'date' && bucket !== 'none';

  const groups = new Map<string, GroupAcc>();

  for (const rowIdx of order) {
    const row = rows[rowIdx];
    const dimCell = row[dimIdx];
    const name =
      dimCell == null
        ? EMPTY_GROUP
        : useBucket
          ? bucketDate(String(dimCell), bucket, tz, offsetMs)
          : String(dimCell);

    let g = groups.get(name);
    if (!g) {
      g = { sum: 0, count: 0, min: Infinity, max: -Infinity, numCount: 0 };
      groups.set(name, g);
    }
    g.count += 1;

    if (measIdx != null) {
      const mv = row[measIdx];
      const n = typeof mv === 'number' ? mv : Number(mv);
      if (mv != null && !Number.isNaN(n)) {
        g.sum += n;
        g.numCount += 1;
        if (n < g.min) g.min = n;
        if (n > g.max) g.max = n;
      }
    }
  }

  const out = new Map<string, number>();
  for (const [name, g] of groups) out.set(name, reduceGroup(g, config.aggregation));
  return out;
}

/**
 * Single-series chart data: orders (value-desc for bar/pie, name-asc for line)
 * and caps per chart type.
 */
export function aggregate(
  dataset: Dataset,
  order: number[],
  config: ChartConfig,
  tz: string = DEFAULT_TZ,
): ChartResult {
  const map = aggregateToMap(dataset, order, config, tz);
  const data: ChartDatum[] = [...map.entries()].map(([name, value]) => ({
    name,
    value,
  }));

  if (config.type === 'line') {
    data.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  } else {
    data.sort((a, b) => b.value - a.value);
  }

  return { data: data.slice(0, CAPS[config.type]), groupCount: map.size };
}
