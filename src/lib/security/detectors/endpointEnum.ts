import type { Dataset } from '@/types/dataset';
import type { Finding } from '@/lib/analysis/findings';
import {
  cellText,
  guessColumn,
  IP_NEEDLES,
  STATUS_NEEDLES,
  ENDPOINT_NEEDLES,
} from '../util';

export interface EndpointEnumOptions {
  /** Minimum distinct 4xx endpoints from one source to flag it. */
  threshold?: number;
}

/** Client errors only (401/403/404/…) — server 5xx isn't a probing signal. */
const CLIENT_ERROR = /^4\d\d$/;

/**
 * Flags path enumeration / forced browsing: one source that drew 4xx responses
 * across many *distinct* endpoints (a wordlist scan for hidden paths). Needs a
 * source, a status, and a request-target column; no-ops otherwise.
 */
export function endpointEnum(
  dataset: Dataset,
  order: number[],
  opts: EndpointEnumOptions = {},
): Finding[] {
  const threshold = opts.threshold ?? 6;

  const ipCol = guessColumn(dataset, IP_NEEDLES);
  const statusCol = guessColumn(dataset, STATUS_NEEDLES);
  const targetCol = guessColumn(dataset, ENDPOINT_NEEDLES);
  if (ipCol < 0 || statusCol < 0 || targetCol < 0) return [];
  if (targetCol === ipCol || targetCol === statusCol) return [];

  const bySource = new Map<string, Set<string>>();
  for (const r of order) {
    const row = dataset.rows[r];
    if (!CLIENT_ERROR.test(cellText(row[statusCol]).trim())) continue;
    const ip = cellText(row[ipCol]);
    const target = cellText(row[targetCol]);
    if (!ip || !target) continue;
    let set = bySource.get(ip);
    if (!set) {
      set = new Set();
      bySource.set(ip, set);
    }
    set.add(target);
  }

  const findings: Finding[] = [];
  for (const [ip, set] of bySource) {
    if (set.size >= threshold) {
      findings.push({
        severity: set.size >= threshold * 3 ? 'high' : 'medium',
        rule: 'path-enumeration',
        entity: ip,
        detail: `${set.size} distinct endpoints returned 4xx (probing)`,
        count: set.size,
        technique: 'T1595.003 · Wordlist Scanning',
      });
    }
  }
  return findings;
}
