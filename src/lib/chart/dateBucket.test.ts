import { describe, it, expect } from 'vitest';
import { bucketDate } from './dateBucket';

const ts = '2026-06-19T08:01:12'; // a Friday

describe('bucketDate', () => {
  it('buckets to hour/day/month with zero-padded labels', () => {
    expect(bucketDate(ts, 'hour')).toBe('2026-06-19 08:00');
    expect(bucketDate(ts, 'day')).toBe('2026-06-19');
    expect(bucketDate(ts, 'month')).toBe('2026-06');
  });

  it('anchors weeks to the preceding Monday', () => {
    expect(bucketDate(ts, 'week')).toBe('2026-06-15'); // Mon of that week
  });

  it('returns the raw value for none or unparseable input', () => {
    expect(bucketDate(ts, 'none')).toBe(ts);
    expect(bucketDate('not-a-date', 'day')).toBe('not-a-date');
  });

  it('buckets in the chosen display timezone (deterministic)', () => {
    // 23:30 UTC on Jun 19 → 01:30 Jun 20 in Berlin (CEST +2): crosses the day.
    const z = '2026-06-19T23:30:00Z';
    expect(bucketDate(z, 'hour', 'Europe/Berlin')).toBe('2026-06-20 01:00');
    expect(bucketDate(z, 'day', 'Europe/Berlin')).toBe('2026-06-20');
    expect(bucketDate(z, 'day', 'UTC')).toBe('2026-06-19');
  });

  it('shifts the instant by offsetMs before bucketing (time-sync)', () => {
    const z = '2026-06-19T08:40:00Z';
    // +1h offset pushes 08:40 into the 09:00 hour bucket.
    expect(bucketDate(z, 'hour', 'UTC', 3_600_000)).toBe('2026-06-19 09:00');
    // −1h pulls it back to 07:00.
    expect(bucketDate(z, 'hour', 'UTC', -3_600_000)).toBe('2026-06-19 07:00');
  });

  it('produces chronologically sortable labels', () => {
    const labels = ['2026-06-19T23:30', '2026-06-20T00:15', '2026-06-19T09:00'].map(
      (s) => bucketDate(s, 'hour'),
    );
    expect([...labels].sort()).toEqual([
      '2026-06-19 09:00',
      '2026-06-19 23:00',
      '2026-06-20 00:00',
    ]);
  });
});
