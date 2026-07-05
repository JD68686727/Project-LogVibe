import { describe, it, expect } from 'vitest';
import { newAlertKeys, notify, notifySupported } from './notify';
import { SEVERITY_RANK, type Finding } from '@/lib/analysis/findings';

const f = (
  severity: Finding['severity'],
  rule: string,
  entity: string,
): Finding => ({ severity, rule, entity, detail: '', count: 1 });

const HIGH = SEVERITY_RANK.high;

describe('newAlertKeys', () => {
  it('returns only findings at/above the severity threshold', () => {
    const keys = newAlertKeys(
      new Set(),
      [f('high', 'brute-force', 'x'), f('low', 'noise', 'y'), f('critical', 'c', 'z')],
      HIGH,
    );
    expect(keys).toEqual(['brute-force x', 'c z']); // low is filtered out
  });

  it('skips keys already seen and dedupes within a call', () => {
    const seen = new Set(['brute-force x']);
    const keys = newAlertKeys(
      seen,
      [f('high', 'brute-force', 'x'), f('high', 'payload', 'q'), f('high', 'payload', 'q')],
      HIGH,
    );
    expect(keys).toEqual(['payload q']); // seen dropped, duplicate collapsed
  });
});

describe('notify', () => {
  it('no-ops (no throw) when the Notification API is unavailable', () => {
    // vitest node env: no `window`/`Notification`.
    expect(notifySupported()).toBe(false);
    expect(() => notify('t', 'b')).not.toThrow();
  });
});
