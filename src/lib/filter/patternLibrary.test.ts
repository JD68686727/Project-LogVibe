import { describe, it, expect } from 'vitest';
import { PATTERN_LIBRARY, extractMatches } from './patternLibrary';
import { makeDataset } from '@/test/factory';

const byId = (id: string) => PATTERN_LIBRARY.find((p) => p.id === id)!;
const test = (id: string, s: string) => new RegExp(byId(id).regex, 'i').test(s);

describe('PATTERN_LIBRARY regexes', () => {
  it('match representative samples', () => {
    expect(test('ipv4', 'src 10.0.0.4 done')).toBe(true);
    expect(test('ipv6', 'addr fe80::1ff:fe23:4567 ok')).toBe(true);
    expect(test('mac', 'mac 00:1A:2B:3C:4D:5E up')).toBe(true);
    expect(test('email', 'from ops@example.com sent')).toBe(true);
    expect(test('http-err', 'status 404')).toBe(true);
    expect(test('http-err', 'status 500')).toBe(true);
    expect(test('uuid', 'id 550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('reject non-matches', () => {
    expect(test('http-err', 'status 200')).toBe(false);
    expect(test('email', 'no at sign here')).toBe(false);
  });

  it('bounds IPv4 octets to 0–255', () => {
    expect(test('ipv4', 'ip 255.255.255.255')).toBe(true);
    expect(test('ipv4', 'ip 10.1.2.3444')).toBe(false); // 4-digit octet
    expect(test('ipv4', 'ip 999.1.1.1')).toBe(false); // > 255
    expect(test('ipv4', 'ip 256.0.0.1')).toBe(false);
  });
});

describe('extractMatches', () => {
  const ds = makeDataset(
    [
      { name: 'msg', key: 'msg', type: 'string' },
      { name: 'ip', key: 'ip', type: 'string' },
    ],
    [
      ['login from 10.0.0.4', '10.0.0.4'],
      ['login from 10.0.0.9', '10.0.0.9'],
      ['retry 10.0.0.4', '10.0.0.4'],
    ],
  );

  it('dedupes matches across cells and counts occurrences', () => {
    const out = extractMatches(ds, [0, 1, 2], byId('ipv4'));
    expect(out).toEqual([
      { value: '10.0.0.4', count: 4 }, // 2 in msg + 2 in ip
      { value: '10.0.0.9', count: 2 },
    ]);
  });

  it('respects the row order subset', () => {
    const out = extractMatches(ds, [1], byId('ipv4'));
    expect(out).toEqual([{ value: '10.0.0.9', count: 2 }]);
  });
});
