import { describe, it, expect } from 'vitest';
import type { LogPattern } from '@/types/logPattern';
import { compilePattern, parseLogText } from './regexParser';

const NGINX: LogPattern = {
  regex:
    '^(?<ip>\\S+) \\S+ \\S+ \\[(?<ts>[^\\]]+)\\] "(?<request>[^"]*)" (?<status>\\d+) (?<bytes>\\S+)',
  flags: '',
};

describe('compilePattern', () => {
  it('extracts named groups in source order', () => {
    const r = compilePattern({ regex: '(?<a>\\S+) (?<b>\\S+) (?<c>\\S+)', flags: '' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fields).toEqual(['a', 'b', 'c']);
  });

  it('rejects a pattern with no named groups', () => {
    const r = compilePattern({ regex: '\\S+ \\S+', flags: '' });
    expect(r.ok).toBe(false);
  });

  it('rejects an invalid regex', () => {
    const r = compilePattern({ regex: '(?<a>(', flags: '' });
    expect(r.ok).toBe(false);
  });

  it('strips stateful g/y flags', () => {
    const r = compilePattern({ regex: '(?<a>\\S+)', flags: 'gi' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.re.flags).toBe('i');
  });
});

describe('parseLogText', () => {
  const sample = [
    '127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /api/users HTTP/1.1" 200 1234',
    '', // blank → skipped
    'this line does not match the pattern at all',
    '10.0.0.9 - - [10/Oct/2023:13:55:40 +0000] "POST /api/login HTTP/1.1" 401 64',
  ].join('\n');

  it('parses matching lines into headers + rows, counts unmatched, skips blanks', () => {
    const r = parseLogText(sample, NGINX);
    expect(r.headers).toEqual(['ip', 'ts', 'request', 'status', 'bytes']);
    expect(r.matched).toBe(2);
    expect(r.unmatched).toBe(1);
    expect(r.rows[0]).toEqual([
      '127.0.0.1',
      '10/Oct/2023:13:55:36 +0000',
      'GET /api/users HTTP/1.1',
      '200',
      '1234',
    ]);
    expect(r.rows[1][3]).toBe('401');
  });

  it('parses a syslog line with a message captured to end-of-line', () => {
    const syslog: LogPattern = {
      regex:
        '^(?<ts>\\w{3}\\s+\\d+ \\d{2}:\\d{2}:\\d{2}) (?<host>\\S+) (?<process>[^:]+): (?<message>.*)$',
      flags: '',
    };
    const r = parseLogText(
      'Oct 10 13:55:36 myhost sshd[1234]: Failed password for root',
      syslog,
    );
    expect(r.headers).toEqual(['ts', 'host', 'process', 'message']);
    expect(r.rows[0]).toEqual([
      'Oct 10 13:55:36',
      'myhost',
      'sshd[1234]',
      'Failed password for root',
    ]);
  });

  it('respects the row cap and flags truncation', () => {
    const many = Array.from({ length: 10 }, () => '1.1.1.1 - - [t] "x" 200 1').join('\n');
    const r = parseLogText(many, NGINX, { maxRows: 4 });
    expect(r.matched).toBe(4);
    expect(r.truncated).toBe(true);
  });
});
