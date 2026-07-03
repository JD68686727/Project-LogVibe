export const TIMEZONE_STORAGE_KEY = 'logvibe.tz';

/** Sentinel meaning "the viewer's browser zone"; anything else is an IANA id. */
export const LOCAL_TZ = 'local';
export const DEFAULT_TZ = 'UTC';

/** Options offered in the header selector. `Local` resolves at runtime. */
export const COMMON_ZONES: { id: string; label: string }[] = [
  { id: 'UTC', label: 'UTC' },
  { id: LOCAL_TZ, label: 'Local (browser)' },
  { id: 'Europe/London', label: 'Europe/London' },
  { id: 'Europe/Berlin', label: 'Europe/Berlin' },
  { id: 'America/New_York', label: 'America/New York' },
  { id: 'America/Los_Angeles', label: 'America/Los Angeles' },
  { id: 'Asia/Tokyo', label: 'Asia/Tokyo' },
];

/** Maps our stored value to a concrete IANA zone Intl understands. */
export function resolveZone(tz: string): string {
  if (tz === LOCAL_TZ) {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }
  return tz || DEFAULT_TZ;
}

/** True when the string already carries a timezone designator (`Z` or `±HH:MM`). */
const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/;
/** ISO-ish date or datetime, e.g. `2026-06-19` or `2026-06-19T08:01:12`. */
const NAIVE_ISO = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/;

/** Normalizes a naive ISO-ish string to an explicit-UTC instant string. */
function toUtcIso(s: string): string {
  const base = s.replace(' ', 'T');
  return /T\d{2}:\d{2}/.test(base) ? `${base}Z` : `${base}T00:00:00Z`;
}

/**
 * Parses a raw timestamp to an epoch-millis instant. A string with an explicit
 * zone is honoured; a naive ISO-ish string is treated as **UTC** so results
 * don't silently depend on the runtime's local zone the way `Date.parse`
 * otherwise would. Returns null when unparseable.
 */
export function parseToInstant(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const iso = HAS_ZONE.test(s) ? s : NAIVE_ISO.test(s) ? toUtcIso(s) : s;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(zone: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(zone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatterCache.set(zone, fmt);
  }
  return fmt;
}

export interface ZonedParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
}

/** Wall-clock calendar fields of an instant in the given display zone, each
 *  zero-padded (year is 4-digit). Shared by cell display and chart bucketing. */
export function zonedParts(instant: number, tz: string): ZonedParts {
  const p: Record<string, string> = {};
  for (const part of formatterFor(resolveZone(tz)).formatToParts(instant)) {
    p[part.type] = part.value;
  }
  return {
    year: p.year,
    month: p.month,
    day: p.day,
    hour: p.hour,
    minute: p.minute,
    second: p.second,
  };
}

/**
 * Renders a raw timestamp in the given display zone as a stable
 * `YYYY-MM-DD HH:mm:ss` string. Unparseable input is returned unchanged so no
 * data is ever hidden. Formatters are cached per resolved zone; only visible
 * (virtualized) rows are formatted, so large tables stay cheap.
 */
export function formatTimestamp(raw: string, tz: string): string {
  const t = parseToInstant(raw);
  if (t == null) return raw;
  const p = zonedParts(t, tz);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}
