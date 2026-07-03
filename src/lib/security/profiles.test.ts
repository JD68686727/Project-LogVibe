import { describe, it, expect } from 'vitest';
import { makeDataset, allRows } from '@/test/factory';
import { bruteForce } from './detectors/bruteForce';
import { httpErrorBurst } from './detectors/httpErrorBurst';
import { endpointEnum } from './detectors/endpointEnum';
import { offHours } from './detectors/offHours';
import { runProfiles } from './profiles';

/** 6 failed logins from .66 inside 60s, plus noise from other IPs. */
function authDataset() {
  const rows: [string, string, string][] = [
    ['2026-06-19T08:00:01', 'login_failed', '10.0.0.66'],
    ['2026-06-19T08:00:08', 'login_failed', '10.0.0.66'],
    ['2026-06-19T08:00:15', 'login_failed', '10.0.0.66'],
    ['2026-06-19T08:00:22', 'login_failed', '10.0.0.66'],
    ['2026-06-19T08:00:36', 'login_failed', '10.0.0.66'],
    ['2026-06-19T08:00:52', 'login_failed', '10.0.0.66'],
    ['2026-06-19T08:00:10', 'login_ok', '10.0.0.7'],
    ['2026-06-19T09:30:00', 'login_failed', '10.0.0.9'], // lone failure
  ];
  return makeDataset(
    [
      { name: 'timestamp', type: 'date' },
      { name: 'event', type: 'string' },
      { name: 'src_ip', type: 'string' },
    ],
    rows,
  );
}

describe('bruteForce', () => {
  it('flags a source with ≥threshold failures inside the window', () => {
    const ds = authDataset();
    const findings = bruteForce(ds, allRows(ds));
    expect(findings).toHaveLength(1);
    expect(findings[0].entity).toBe('10.0.0.66');
    expect(findings[0].rule).toBe('brute-force');
    expect(findings[0].count).toBe(6);
    expect(findings[0].severity).toBe('high'); // 6 failures: ≥threshold(5) but < 3×threshold
    expect(findings[0].technique).toBe('T1110 · Brute Force');
  });

  it('does not flag spread-out failures beyond the window', () => {
    const ds = authDataset();
    const findings = bruteForce(ds, allRows(ds), { windowMs: 5_000 });
    expect(findings).toHaveLength(0);
  });

  it('no-ops when there is no timestamp or source column', () => {
    const ds = makeDataset(
      [{ name: 'msg', type: 'string' }],
      [['login_failed'], ['login_failed']],
    );
    expect(bruteForce(ds, allRows(ds))).toEqual([]);
  });
});

describe('httpErrorBurst', () => {
  it('flags a client with ≥threshold 4xx/5xx responses', () => {
    const ds = makeDataset(
      [
        { name: 'status_code', type: 'number' },
        { name: 'client_ip', type: 'string' },
      ],
      [
        [500, '10.0.0.9'],
        [503, '10.0.0.9'],
        [404, '10.0.0.9'],
        [401, '10.0.0.9'],
        [500, '10.0.0.9'],
        [200, '10.0.0.7'],
      ],
    );
    const findings = httpErrorBurst(ds, allRows(ds), { threshold: 5 });
    expect(findings).toHaveLength(1);
    expect(findings[0].entity).toBe('10.0.0.9');
    expect(findings[0].count).toBe(5);
    expect(findings[0].rule).toBe('http-error-burst');
  });
});

describe('endpointEnum', () => {
  it('flags a source hitting many distinct 4xx endpoints', () => {
    const rows = Array.from({ length: 7 }, (_, i) => [404, `/admin/${i}`, '10.0.0.30']);
    rows.push([200, '/home', '10.0.0.7']);
    const ds = makeDataset(
      [
        { name: 'status_code', type: 'number' },
        { name: 'endpoint', type: 'string' },
        { name: 'client_ip', type: 'string' },
      ],
      rows,
    );
    const findings = endpointEnum(ds, allRows(ds));
    expect(findings).toHaveLength(1);
    expect(findings[0].entity).toBe('10.0.0.30');
    expect(findings[0].count).toBe(7);
    expect(findings[0].technique).toBe('T1595.003 · Wordlist Scanning');
  });

  it('ignores repeated hits on the same endpoint (distinct only)', () => {
    const rows = Array.from({ length: 8 }, () => [404, '/login', '10.0.0.30']);
    const ds = makeDataset(
      [
        { name: 'status_code', type: 'number' },
        { name: 'endpoint', type: 'string' },
        { name: 'client_ip', type: 'string' },
      ],
      rows,
    );
    expect(endpointEnum(ds, allRows(ds))).toEqual([]);
  });
});

describe('offHours', () => {
  it('flags a source with ≥threshold events outside business hours', () => {
    const ds = makeDataset(
      [
        { name: 'timestamp', type: 'date' },
        { name: 'src_ip', type: 'string' },
      ],
      [
        ['2026-06-19T02:14:00', '10.0.0.99'],
        ['2026-06-19T03:01:00', '10.0.0.99'],
        ['2026-06-19T23:40:00', '10.0.0.99'],
        ['2026-06-19T09:00:00', '10.0.0.99'], // business hours → ignored
        ['2026-06-19T01:00:00', '10.0.0.7'], // below threshold
      ],
    );
    const findings = offHours(ds, allRows(ds));
    expect(findings).toHaveLength(1);
    expect(findings[0].entity).toBe('10.0.0.99');
    expect(findings[0].count).toBe(3);
    expect(findings[0].technique).toBe('T1078 · Valid Accounts');
  });
});

describe('runProfiles', () => {
  it('runs all profiles and concatenates findings', () => {
    const ds = authDataset();
    const findings = runProfiles(ds, allRows(ds));
    // Only brute-force applies to this schema (no status/endpoint column, and
    // all events are during business hours).
    expect(findings.map((f) => f.rule)).toEqual(['brute-force']);
  });

  it('can restrict to a subset of profiles by id', () => {
    const ds = authDataset();
    expect(runProfiles(ds, allRows(ds), ['http-error-burst'])).toEqual([]);
  });
});
