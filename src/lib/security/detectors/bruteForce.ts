import type { Dataset } from '@/types/dataset';
import type { Finding } from '@/lib/analysis/findings';
import { parseToInstant } from '@/lib/time/timezone';
import { cellText, guessColumn, rowText, IP_NEEDLES, TIME_NEEDLES } from '../util';

export interface BruteForceOptions {
  /** Minimum failures within the window to flag a source. */
  threshold?: number;
  /** Sliding-window width in milliseconds. */
  windowMs?: number;
}

/**
 * Tokens that mark an authentication failure across common log formats. Matched
 * as substrings (not whole words) so structured fields like `login_failed` —
 * where `_` blocks a `\b` boundary — are still caught.
 */
const FAIL_RE = /fail(?:ed|ure)?|invalid|denied|unauthor|incorrect|4625/i;

/**
 * Flags brute-force login behaviour: at least `threshold` failed attempts from
 * the same source address inside a sliding `windowMs` window. Stateful (it
 * groups by source and scans a time window), so it runs over the assembled
 * Dataset rather than at parse time. No-ops if there's no source or time column.
 */
export function bruteForce(
  dataset: Dataset,
  order: number[],
  opts: BruteForceOptions = {},
): Finding[] {
  const threshold = opts.threshold ?? 5;
  const windowMs = opts.windowMs ?? 60_000;

  const ipCol = guessColumn(dataset, IP_NEEDLES);
  const timeCol = guessColumn(dataset, TIME_NEEDLES);
  if (ipCol < 0 || timeCol < 0) return [];

  // Collect failure timestamps per source.
  const byIp = new Map<string, number[]>();
  for (const r of order) {
    const row = dataset.rows[r];
    if (!FAIL_RE.test(rowText(row))) continue;
    const ip = cellText(row[ipCol]);
    if (!ip) continue;
    // parseToInstant treats a naive timestamp as UTC (deterministic, and
    // consistent with how the table/charts read dates) and honours an explicit
    // offset — unlike Date.parse, which reads naive times as engine-local.
    const t = parseToInstant(cellText(row[timeCol]));
    if (t == null) continue;
    const arr = byIp.get(ip);
    if (arr) arr.push(t);
    else byIp.set(ip, [t]);
  }

  const findings: Finding[] = [];
  for (const [ip, times] of byIp) {
    times.sort((a, b) => a - b);
    // Widest failure burst within any window (two-pointer sweep).
    let lo = 0;
    let best = 0;
    let bestSpanMs = 0;
    for (let hi = 0; hi < times.length; hi++) {
      while (times[hi] - times[lo] > windowMs) lo++;
      const n = hi - lo + 1;
      if (n > best) {
        best = n;
        bestSpanMs = times[hi] - times[lo];
      }
    }
    if (best >= threshold) {
      findings.push({
        severity: best >= threshold * 3 ? 'critical' : 'high',
        rule: 'brute-force',
        entity: ip,
        detail: `${best} failed attempts within ${Math.max(1, Math.round(bestSpanMs / 1000))}s`,
        count: best,
        technique: 'T1110 · Brute Force',
      });
    }
  }
  return findings;
}
