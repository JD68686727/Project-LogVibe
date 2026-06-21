// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSortedRows } from './useSortedRows';
import { makeDataset, allRows } from '@/test/factory';

// rows: 30, 10, null, 20  → asc = [1,3,0,2] (nulls last), desc = [0,3,1,2]
const ds = makeDataset([{ name: 'n', key: 'n', type: 'number' }], [
  [30],
  [10],
  [null],
  [20],
]);

describe('useSortedRows', () => {
  it('returns the base order untouched when unsorted', () => {
    const base = allRows(ds);
    const { result } = renderHook(() => useSortedRows(ds, base));
    expect(result.current.sort).toBeNull();
    expect(result.current.order).toBe(base);
  });

  it('toggleSort cycles asc → desc → cleared, nulls last', () => {
    const { result } = renderHook(() => useSortedRows(ds, allRows(ds)));

    act(() => result.current.toggleSort('n'));
    expect(result.current.sort).toEqual({ columnKey: 'n', direction: 'asc' });
    expect(result.current.order).toEqual([1, 3, 0, 2]);

    act(() => result.current.toggleSort('n'));
    expect(result.current.sort).toEqual({ columnKey: 'n', direction: 'desc' });
    expect(result.current.order).toEqual([0, 3, 1, 2]);

    act(() => result.current.toggleSort('n'));
    expect(result.current.sort).toBeNull();
  });

  it('setSort applies a sort outright', () => {
    const { result } = renderHook(() => useSortedRows(ds, allRows(ds)));
    act(() => result.current.setSort({ columnKey: 'n', direction: 'asc' }));
    expect(result.current.order).toEqual([1, 3, 0, 2]);
  });
});
