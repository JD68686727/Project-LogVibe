import { describe, it } from 'vitest';
import type { CellValue, ColumnSchema, Dataset, LogRow } from '@/types/dataset';
import type { FilterGroup } from '@/types/filter';
import type { SortKey } from '@/types/table';
import type { PivotConfig } from '@/types/pivot';
import type { ChartConfig } from '@/types/chart';
import { applyFilterGroups } from '@/lib/filter/applyFilters';
import { applyQuickSearch } from '@/lib/filter/quickSearch';
import { applyMultiSort } from '@/lib/table/multiSort';
import { computeColumnStats } from '@/lib/stats/computeColumnStats';
import { computeColumnDistributions } from '@/lib/stats/distribution';
import { computePivot } from '@/lib/pivot/computePivot';
import { aggregate } from '@/lib/chart/aggregate';

/**
 * Env-gated performance harness — skipped by default (and in CI). Run with:
 *   PERF=1 npx vitest run src/perf/pipeline.perf.test.ts   (bash)
 *   $env:PERF=1; npx vitest run src/perf/pipeline.perf.test.ts   (PowerShell)
 * Prints median wall-clock per pipeline stage over a synthetic large dataset.
 */

const N = Number(process.env.PERF_ROWS ?? 100_000);

const COLUMNS: ColumnSchema[] = [
  { name: 'timestamp', key: 'timestamp', type: 'date' },
  { name: 'level', key: 'level', type: 'string' },
  { name: 'status_code', key: 'status_code', type: 'number' },
  { name: 'latency_ms', key: 'latency_ms', type: 'number' },
  { name: 'endpoint', key: 'endpoint', type: 'string' },
  { name: 'cached', key: 'cached', type: 'boolean' },
  { name: 'client_ip', key: 'client_ip', type: 'string' },
];

const LEVELS = ['INFO', 'INFO', 'INFO', 'WARN', 'ERROR', 'DEBUG'];
const CODES = [200, 200, 201, 204, 301, 400, 404, 429, 500, 503];
const ENDPOINTS = Array.from({ length: 30 }, (_, i) => `/api/resource/${i}`);

function buildDataset(rows: number): Dataset {
  const base = Date.parse('2026-01-01T00:00:00Z');
  const data: LogRow[] = new Array(rows);
  for (let i = 0; i < rows; i++) {
    const r = (i * 2654435761) >>> 0; // cheap deterministic pseudo-random
    const row: CellValue[] = [
      new Date(base + i * 1000).toISOString(),
      LEVELS[r % LEVELS.length],
      CODES[(r >>> 3) % CODES.length],
      1 + ((r >>> 7) % 3000),
      ENDPOINTS[(r >>> 11) % ENDPOINTS.length],
      (r & 1) === 0,
      `10.0.${(r >>> 5) % 256}.${(r >>> 13) % 256}`,
    ];
    data[i] = row;
  }
  const columnIndex: Record<string, number> = {};
  COLUMNS.forEach((c, i) => (columnIndex[c.key] = i));
  return {
    columns: COLUMNS,
    rows: data,
    columnIndex,
    meta: {
      fileName: 'perf.csv',
      fileSize: 0,
      rowCount: rows,
      delimiter: ',',
      truncated: false,
    },
  };
}

function bench(label: string, fn: () => void, runs = 7): void {
  fn(); // warm up
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    fn();
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  // eslint-disable-next-line no-console
  console.log(`  ${label.padEnd(28)} ${median.toFixed(1).padStart(7)} ms`);
}

describe.skipIf(!process.env.PERF)('pipeline perf', () => {
  it(`profiles the pipeline over ${N.toLocaleString()} rows`, { timeout: 300_000 }, () => {
    const ds = buildDataset(N);
    const all = ds.rows.map((_, i) => i);

    const groups: FilterGroup[] = [
      {
        id: 'g',
        filters: [
          { id: 'f', columnKey: 'status_code', operator: 'gte', value: '500' },
        ],
      },
    ];
    const numericSort: SortKey[] = [{ columnKey: 'latency_ms', direction: 'desc' }];
    const stringSort: SortKey[] = [
      { columnKey: 'endpoint', direction: 'asc' },
      { columnKey: 'level', direction: 'asc' },
    ];
    const pivotConfig: PivotConfig = {
      rowKey: 'endpoint',
      colKey: 'level',
      aggregation: 'avg',
      measureKey: 'latency_ms',
    };
    const chartConfig: ChartConfig = {
      type: 'bar',
      dimensionKey: 'endpoint',
      measureKey: 'latency_ms',
      aggregation: 'avg',
      bucket: 'none',
    };

    // eslint-disable-next-line no-console
    console.log(`\nPipeline perf — ${N.toLocaleString()} rows (median of 7):`);
    bench('filter (status >= 500)', () => applyFilterGroups(ds, groups));
    bench('quick search ("api")', () => applyQuickSearch(ds, all, 'api'));
    bench('sort numeric (latency)', () => applyMultiSort(ds, all, numericSort));
    bench('sort string (endpoint,level)', () => applyMultiSort(ds, all, stringSort));
    bench('column stats', () => computeColumnStats(ds, all));
    bench('distributions', () => computeColumnDistributions(ds, all));
    bench('pivot (avg, 30x4)', () => computePivot(ds, all, pivotConfig));
    bench('chart aggregate (avg)', () => aggregate(ds, all, chartConfig));
  });
});
