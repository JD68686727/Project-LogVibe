import type { Dataset } from '@/types/dataset';
import type { Finding } from '@/lib/analysis/findings';
import { cellText, guessColumn, IP_NEEDLES, STATUS_NEEDLES } from '../util';

export interface HttpErrorBurstOptions {
  /** Minimum 4xx/5xx responses from one source to flag it. */
  threshold?: number;
}

const HTTP_ERROR = /^[45]\d\d$/;

/**
 * Flags scanning / abuse behaviour: a single source that drew at least
 * `threshold` HTTP 4xx/5xx responses. Reuses the same source-column heuristic
 * as brute-force and a status column. No-ops without both columns.
 */
export function httpErrorBurst(
  dataset: Dataset,
  order: number[],
  opts: HttpErrorBurstOptions = {},
): Finding[] {
  const threshold = opts.threshold ?? 5;

  const ipCol = guessColumn(dataset, IP_NEEDLES);
  const statusCol = guessColumn(dataset, STATUS_NEEDLES);
  if (ipCol < 0 || statusCol < 0 || ipCol === statusCol) return [];

  const counts = new Map<string, number>();
  for (const r of order) {
    const row = dataset.rows[r];
    if (!HTTP_ERROR.test(cellText(row[statusCol]).trim())) continue;
    const ip = cellText(row[ipCol]);
    if (!ip) continue;
    counts.set(ip, (counts.get(ip) ?? 0) + 1);
  }

  const findings: Finding[] = [];
  for (const [ip, n] of counts) {
    if (n >= threshold) {
      findings.push({
        severity: n >= threshold * 4 ? 'high' : 'medium',
        rule: 'http-error-burst',
        entity: ip,
        detail: `${n} HTTP 4xx/5xx responses`,
        count: n,
        technique: 'T1595 · Active Scanning',
      });
    }
  }
  return findings;
}
