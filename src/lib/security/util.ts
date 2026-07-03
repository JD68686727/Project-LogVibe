import type { CellValue, Dataset, LogRow } from '@/types/dataset';

/**
 * Finds the first column whose key or name contains any of the given needles
 * (case-insensitive) — a tolerant way for detectors to locate the "ip",
 * "timestamp", "status", … column across the wildly varying log schemas we
 * ingest, without the user having to map fields first.
 */
export function guessColumn(dataset: Dataset, needles: readonly string[]): number {
  return dataset.columns.findIndex((c) => {
    const key = c.key.toLowerCase();
    const name = c.name.toLowerCase();
    return needles.some((n) => key.includes(n) || name.includes(n));
  });
}

export function cellText(v: CellValue): string {
  return v == null ? '' : String(v);
}

/** Whole-row text, for signal matching (e.g. "failed"/"denied" anywhere). */
export function rowText(row: LogRow): string {
  return row.map(cellText).join(' ');
}

/** Common column-name hints for the source/client address. */
export const IP_NEEDLES = [
  'client_ip',
  'src_ip',
  'source',
  'remote',
  'client',
  'ip',
  'host',
] as const;

export const TIME_NEEDLES = ['timestamp', 'time', 'date'] as const;

/** Common column-name hints for an HTTP status / response code. */
export const STATUS_NEEDLES = ['status', 'code', 'response'] as const;

/** Common column-name hints for a request target (URL / path / port). */
export const ENDPOINT_NEEDLES = [
  'endpoint',
  'url',
  'uri',
  'path',
  'resource',
  'request',
  'port',
] as const;
