import type { Dataset } from '@/types/dataset';
import type { Finding } from '@/lib/analysis/findings';
import { cellText, guessColumn, IP_NEEDLES, TIME_NEEDLES } from '../util';

export interface OffHoursOptions {
  /** Minimum off-hours events from one source to flag it. */
  threshold?: number;
  /** Start of business hours (inclusive), 0–23. */
  startHour?: number;
  /** End of business hours (exclusive), 0–23. */
  endHour?: number;
}

/** Pulls the hour from an ISO-ish timestamp WITHOUT `Date` — parsing the string
 *  keeps it deterministic regardless of the runtime's timezone. */
const HOUR_RE = /(?:^|[T\s])(\d{2}):\d{2}/;
function hourOf(ts: string): number | null {
  const m = HOUR_RE.exec(ts);
  if (!m) return null;
  const h = Number(m[1]);
  return h >= 0 && h <= 23 ? h : null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Flags activity outside business hours: a source with at least `threshold`
 * events before `startHour` or at/after `endHour`. Needs a source and a time
 * column; rows without a parseable hour are ignored.
 */
export function offHours(
  dataset: Dataset,
  order: number[],
  opts: OffHoursOptions = {},
): Finding[] {
  const threshold = opts.threshold ?? 3;
  const startHour = opts.startHour ?? 6;
  const endHour = opts.endHour ?? 22;

  const ipCol = guessColumn(dataset, IP_NEEDLES);
  const timeCol = guessColumn(dataset, TIME_NEEDLES);
  if (ipCol < 0 || timeCol < 0) return [];

  const counts = new Map<string, number>();
  for (const r of order) {
    const row = dataset.rows[r];
    const h = hourOf(cellText(row[timeCol]));
    if (h == null || (h >= startHour && h < endHour)) continue; // business hours
    const ip = cellText(row[ipCol]);
    if (!ip) continue;
    counts.set(ip, (counts.get(ip) ?? 0) + 1);
  }

  const findings: Finding[] = [];
  for (const [ip, n] of counts) {
    if (n >= threshold) {
      findings.push({
        severity: 'medium',
        rule: 'off-hours-activity',
        entity: ip,
        detail: `${n} events outside ${pad(startHour)}:00–${pad(endHour)}:00`,
        count: n,
        technique: 'T1078 · Valid Accounts',
      });
    }
  }
  return findings;
}
