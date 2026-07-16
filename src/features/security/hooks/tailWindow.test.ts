import { describe, it, expect } from 'vitest';
import { makeDataset } from '@/test/factory';
import { tailWindow } from './useLiveScan';

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => [String(i)] as (string | number)[]);

describe('tailWindow', () => {
  it('returns the whole dataset (same reference) when within the window', () => {
    const ds = makeDataset([{ name: 'a', type: 'string' }], rows(10));
    const out = tailWindow(ds, 50);
    expect(out.dataset).toBe(ds); // no copy
    expect(out.order).toHaveLength(10);
  });

  it('slices the newest rows when the dataset exceeds the window', () => {
    const ds = makeDataset([{ name: 'a', type: 'string' }], rows(100));
    const out = tailWindow(ds, 30);
    expect(out.dataset.rows).toHaveLength(30);
    expect(out.order).toEqual(Array.from({ length: 30 }, (_, i) => i));
    // Keeps the tail (rows 70..99), and reports the windowed rowCount.
    expect(out.dataset.rows[0][0]).toBe('70');
    expect(out.dataset.rows[29][0]).toBe('99');
    expect(out.dataset.meta.rowCount).toBe(30);
    expect(ds.rows).toHaveLength(100); // original untouched
  });
});
