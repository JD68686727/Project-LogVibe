import type { DateBucket } from '@/types/chart';
import { parseToInstant, zonedParts, DEFAULT_TZ } from '@/lib/time/timezone';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Collapses a timestamp into a coarser, chronologically-sortable bucket label
 * so time-series charts aggregate meaningfully instead of one point per raw
 * timestamp. Labels are zero-padded (`2026-06-19 08:00`, `2026-06`) so the
 * line-chart's lexical name sort stays chronological. Bucketing happens in the
 * given display `tz` (default UTC) so it's deterministic across machines and
 * consistent with the table. `offsetMs` shifts the instant before bucketing —
 * used by Compare time-sync to align two logs with a clock skew. Unparseable
 * input is returned as-is so no rows are silently dropped.
 */
export function bucketDate(
  raw: string,
  bucket: DateBucket,
  tz: string = DEFAULT_TZ,
  offsetMs = 0,
): string {
  if (bucket === 'none') return raw;

  const t = parseToInstant(raw);
  if (t == null) return raw;

  const { year, month, day, hour } = zonedParts(t + offsetMs, tz);

  switch (bucket) {
    case 'hour':
      return `${year}-${month}-${day} ${hour}:00`;
    case 'day':
      return `${year}-${month}-${day}`;
    case 'month':
      return `${year}-${month}`;
    case 'week': {
      // Day-of-week from the zone-local calendar date (weekday is calendar-based
      // once we have the local Y/M/D). Monday-anchored, labelled by that Monday.
      const y = Number(year);
      const mo = Number(month);
      const da = Number(day);
      const dow = new Date(Date.UTC(y, mo - 1, da)).getUTCDay();
      const daysSinceMonday = (dow + 6) % 7;
      const monday = new Date(Date.UTC(y, mo - 1, da - daysSinceMonday));
      return `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())}`;
    }
    default:
      return raw;
  }
}
