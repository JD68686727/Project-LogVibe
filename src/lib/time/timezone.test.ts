import { describe, it, expect } from 'vitest';
import { parseToInstant, formatTimestamp, resolveZone, LOCAL_TZ } from './timezone';

describe('parseToInstant', () => {
  it('honours an explicit zone designator', () => {
    expect(parseToInstant('2026-06-19T08:00:00Z')).toBe(Date.UTC(2026, 5, 19, 8));
    expect(parseToInstant('2026-06-19T10:00:00+02:00')).toBe(Date.UTC(2026, 5, 19, 8));
  });

  it('treats a naive timestamp as UTC (deterministic, not machine-local)', () => {
    expect(parseToInstant('2026-06-19T08:00:00')).toBe(Date.UTC(2026, 5, 19, 8));
    expect(parseToInstant('2026-06-19 08:00:00')).toBe(Date.UTC(2026, 5, 19, 8));
    expect(parseToInstant('2026-06-19')).toBe(Date.UTC(2026, 5, 19));
  });

  it('returns null for unparseable input', () => {
    expect(parseToInstant('not-a-date')).toBeNull();
    expect(parseToInstant('')).toBeNull();
  });
});

describe('formatTimestamp', () => {
  it('renders in UTC unchanged for a Z timestamp', () => {
    expect(formatTimestamp('2026-06-19T08:01:12Z', 'UTC')).toBe('2026-06-19 08:01:12');
  });

  it('converts an offset timestamp into the chosen zone', () => {
    // June → Berlin is CEST (+02:00), New York is EDT (-04:00).
    expect(formatTimestamp('2026-06-19T08:01:12Z', 'Europe/Berlin')).toBe(
      '2026-06-19 10:01:12',
    );
    expect(formatTimestamp('2026-06-19T08:01:12Z', 'America/New_York')).toBe(
      '2026-06-19 04:01:12',
    );
  });

  it('treats a naive timestamp as UTC, so UTC display is unchanged', () => {
    expect(formatTimestamp('2026-06-19 08:01:12', 'UTC')).toBe('2026-06-19 08:01:12');
    expect(formatTimestamp('2026-06-19 08:01:12', 'Europe/Berlin')).toBe(
      '2026-06-19 10:01:12',
    );
  });

  it('passes unparseable text through untouched', () => {
    expect(formatTimestamp('n/a', 'Europe/Berlin')).toBe('n/a');
  });
});

describe('resolveZone', () => {
  it('maps the local sentinel to a concrete IANA zone', () => {
    expect(resolveZone(LOCAL_TZ)).not.toBe(LOCAL_TZ);
    expect(resolveZone('Europe/Berlin')).toBe('Europe/Berlin');
    expect(resolveZone('UTC')).toBe('UTC');
  });
});
