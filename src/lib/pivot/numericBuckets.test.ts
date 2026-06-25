import { describe, it, expect } from 'vitest';
import { makeBucketer } from './numericBuckets';

describe('makeBucketer', () => {
  it('snaps to nice 1/2/5 widths and labels ranges', () => {
    const b = makeBucketer(0, 1000); // raw step ~83 → nice 100
    expect(b.count).toBe(11); // 0..1000 in steps of 100
    expect(b.labelOf(0)).toBe('0–100');
    expect(b.boundsOf(0)).toEqual([0, 100]);
    expect(b.boundsOf(10)).toEqual([1000, 1100]);
  });

  it('assigns values to the right bucket and clamps the ends', () => {
    const b = makeBucketer(0, 1000);
    expect(b.indexOf(0)).toBe(0);
    expect(b.indexOf(150)).toBe(1);
    expect(b.indexOf(1000)).toBe(10); // top edge clamps into the last bucket
    expect(b.indexOf(-50)).toBe(0); // below range clamps to the first
  });

  it('collapses a single value to one exact bucket', () => {
    const b = makeBucketer(5, 5);
    expect(b.count).toBe(1);
    expect(b.labelOf(0)).toBe('5');
    expect(b.boundsOf(0)).toEqual([5, 5]);
    expect(b.indexOf(5)).toBe(0);
  });
});
