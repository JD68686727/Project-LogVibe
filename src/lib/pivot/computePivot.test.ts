import { describe, it, expect } from 'vitest';
import { computePivot } from './computePivot';
import { makeDataset, allRows } from '@/test/factory';

const ds = makeDataset(
  [
    { name: 'level', key: 'level', type: 'string' },
    { name: 'cached', key: 'cached', type: 'boolean' },
    { name: 'latency', key: 'latency', type: 'number' },
  ],
  [
    ['INFO', true, 10],
    ['INFO', true, 30],
    ['INFO', false, 100],
    ['ERROR', false, 200],
    ['ERROR', false, null], // no usable measure
    ['WARN', null, 5], // blank col dimension → skipped
  ],
);

const base = { rowKey: 'level', colKey: 'cached', measureKey: null } as const;

describe('computePivot', () => {
  it('returns null when a dimension is unset', () => {
    expect(
      computePivot(ds, allRows(ds), { ...base, rowKey: null, aggregation: 'count' }),
    ).toBeNull();
  });

  it('counts the (row, col) cross-tab and margins, skipping blank dimensions', () => {
    const p = computePivot(ds, allRows(ds), { ...base, aggregation: 'count' })!;
    expect(p.rowValues).toEqual(['INFO', 'ERROR']); // WARN skipped (blank col), freq desc
    expect(p.colValues).toEqual(['false', 'true']); // false (3) outranks true (2)

    const r = (v: string) => p.rowValues.indexOf(v);
    const c = (v: string) => p.colValues.indexOf(v);
    expect(p.cells[r('INFO')][c('true')]).toBe(2);
    expect(p.cells[r('INFO')][c('false')]).toBe(1);
    expect(p.cells[r('ERROR')][c('false')]).toBe(2);
    expect(p.cells[r('ERROR')][c('true')]).toBe(0);

    expect(p.rowTotals[r('INFO')]).toBe(3);
    expect(p.colTotals[c('false')]).toBe(3);
    expect(p.grandTotal).toBe(5); // 6 rows − 1 blank-col row
    expect(p.max).toBe(2);
  });

  it('sums a measure per cell', () => {
    const p = computePivot(ds, allRows(ds), {
      ...base,
      aggregation: 'sum',
      measureKey: 'latency',
    })!;
    const r = (v: string) => p.rowValues.indexOf(v);
    const c = (v: string) => p.colValues.indexOf(v);
    expect(p.cells[r('INFO')][c('true')]).toBe(40); // 10 + 30
    expect(p.cells[r('ERROR')][c('false')]).toBe(200); // 200 (+ null ignored)
    expect(p.grandTotal).toBe(340); // 10+30+100+200
  });

  it('buckets a numeric axis into nice ranges with drill-down bounds', () => {
    const p = computePivot(ds, allRows(ds), {
      rowKey: 'latency',
      colKey: 'level',
      aggregation: 'count',
      measureKey: null,
      rowBucket: true,
    })!;
    // latency values (both dims present): 5, 10, 30, 100, 200 → step 20 from 0.
    expect(p.rowBounds).not.toBeNull();
    expect(p.colBounds).toBeNull(); // the column axis is still categorical
    expect(p.rowValues[0]).toBe('0–20');
    expect(p.rowBounds![0]).toEqual([0, 20]);

    const r = (label: string) => p.rowValues.indexOf(label);
    const c = (label: string) => p.colValues.indexOf(label);
    expect(p.cells[r('0–20')][c('INFO')]).toBe(1); // latency 10 / INFO
    expect(p.cells[r('0–20')][c('WARN')]).toBe(1); // latency 5 / WARN
    expect(p.cells[r('200–220')][c('ERROR')]).toBe(1); // latency 200 / ERROR
    expect(p.grandTotal).toBe(5);
  });

  it('averages only over rows with a usable measure', () => {
    const p = computePivot(ds, allRows(ds), {
      ...base,
      aggregation: 'avg',
      measureKey: 'latency',
    })!;
    const r = (v: string) => p.rowValues.indexOf(v);
    const c = (v: string) => p.colValues.indexOf(v);
    expect(p.cells[r('INFO')][c('true')]).toBe(20); // (10+30)/2
    expect(p.cells[r('ERROR')][c('false')]).toBe(200); // 200/1, null excluded
  });
});
