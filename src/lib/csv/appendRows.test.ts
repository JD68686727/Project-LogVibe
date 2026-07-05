import { describe, it, expect } from 'vitest';
import { appendRows } from './appendRows';
import { makeDataset } from '@/test/factory';

function base() {
  return makeDataset(
    [
      { name: 'level', type: 'string' },
      { name: 'code', type: 'number' },
    ],
    [['INFO', 200]],
  );
}

describe('appendRows', () => {
  it('coerces new rows against the existing schema and grows the dataset', () => {
    const { dataset } = appendRows(base(), [
      ['WARN', '404'],
      ['ERROR', 'x'], // non-numeric stays the raw string
    ]);
    expect(dataset.rows).toHaveLength(3);
    expect(dataset.meta.rowCount).toBe(3);
    expect(dataset.rows[1]).toEqual(['WARN', 404]); // '404' coerced to number
    expect(dataset.rows[2]).toEqual(['ERROR', 'x']);
  });

  it('returns a new dataset object (fresh rows array) for React', () => {
    const ds = base();
    const { dataset } = appendRows(ds, [['WARN', '1']]);
    expect(dataset).not.toBe(ds);
    expect(dataset.rows).not.toBe(ds.rows);
    expect(ds.rows).toHaveLength(1); // original untouched
  });

  it('stops at the cap and flags truncation', () => {
    const res = appendRows(base(), [['A', '1'], ['B', '2'], ['C', '3']], 2);
    expect(res.dataset.rows).toHaveLength(2); // 1 existing + 1 added
    expect(res.truncated).toBe(true);
    expect(res.dataset.meta.truncated).toBe(true);
  });
});
