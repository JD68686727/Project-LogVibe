import { describe, it, expect } from 'vitest';
import type { ColumnFilter } from '@/types/filter';
import type { FilterGroup } from '@/types/filter';
import { applyFilters, applyFilterGroups, isFilterComplete } from './applyFilters';
import { makeDataset } from '@/test/factory';

const ds = makeDataset(
  [
    { name: 'level', type: 'string' },
    { name: 'code', type: 'number' },
    { name: 'cached', type: 'boolean' },
  ],
  [
    ['INFO', 200, true],
    ['WARN', 404, false],
    ['ERROR', 500, false],
    ['ERROR', 503, null],
    ['INFO', null, true],
  ],
);

const filter = (f: Partial<ColumnFilter>): ColumnFilter => ({
  id: 'f',
  columnKey: 'level',
  operator: 'contains',
  value: '',
  ...f,
});

describe('applyFilters', () => {
  it('returns all rows when no filters are active', () => {
    expect(applyFilters(ds, [])).toEqual([0, 1, 2, 3, 4]);
  });

  it('contains is case-insensitive', () => {
    const out = applyFilters(ds, [filter({ operator: 'contains', value: 'err' })]);
    expect(out).toEqual([2, 3]);
  });

  it('equals on a numeric column compares numerically', () => {
    const out = applyFilters(ds, [
      filter({ columnKey: 'code', operator: 'equals', value: '500' }),
    ]);
    expect(out).toEqual([2]);
  });

  it('gte/lt operate on numeric values, excluding nulls', () => {
    expect(
      applyFilters(ds, [filter({ columnKey: 'code', operator: 'gte', value: '500' })]),
    ).toEqual([2, 3]);
    expect(
      applyFilters(ds, [filter({ columnKey: 'code', operator: 'lt', value: '500' })]),
    ).toEqual([0, 1]);
  });

  it('between is inclusive and order-independent', () => {
    // value/value2 swapped → range [404, 500]; 503 (row 3) is outside it.
    const out = applyFilters(ds, [
      filter({ columnKey: 'code', operator: 'between', value: '500', value2: '404' }),
    ]);
    expect(out).toEqual([1, 2]);
  });

  it('isEmpty / isNotEmpty treat null as empty', () => {
    expect(
      applyFilters(ds, [filter({ columnKey: 'code', operator: 'isEmpty', value: '' })]),
    ).toEqual([4]);
    expect(
      applyFilters(ds, [
        filter({ columnKey: 'code', operator: 'isNotEmpty', value: '' }),
      ]),
    ).toEqual([0, 1, 2, 3]);
  });

  it('isTrue matches only boolean true', () => {
    expect(
      applyFilters(ds, [filter({ columnKey: 'cached', operator: 'isTrue', value: '' })]),
    ).toEqual([0, 4]);
  });

  it('skips incomplete filters (operator needs a value but none given)', () => {
    expect(
      applyFilters(ds, [filter({ columnKey: 'code', operator: 'gt', value: '' })]),
    ).toEqual([0, 1, 2, 3, 4]);
  });

  it('combines multiple filters with AND', () => {
    const out = applyFilters(ds, [
      filter({ operator: 'contains', value: 'error' }),
      filter({ columnKey: 'code', operator: 'gte', value: '503' }),
    ]);
    expect(out).toEqual([3]);
  });

  it('respects a provided base order', () => {
    const out = applyFilters(
      ds,
      [filter({ operator: 'contains', value: 'info' })],
      [4, 0],
    );
    expect(out).toEqual([4, 0]);
  });
});

const group = (id: string, filters: ColumnFilter[]): FilterGroup => ({ id, filters });

describe('applyFilterGroups', () => {
  it('returns all rows when there are no groups or no complete filters', () => {
    expect(applyFilterGroups(ds, [])).toEqual([0, 1, 2, 3, 4]);
    expect(
      applyFilterGroups(ds, [group('g', [filter({ operator: 'gt', value: '' })])]),
    ).toEqual([0, 1, 2, 3, 4]);
  });

  it('AND-s filters within a group', () => {
    const out = applyFilterGroups(ds, [
      group('g', [
        filter({ operator: 'contains', value: 'error' }),
        filter({ columnKey: 'code', operator: 'gte', value: '503' }),
      ]),
    ]);
    expect(out).toEqual([3]);
  });

  it('OR-s separate groups (union, original order preserved)', () => {
    // (level contains INFO) OR (code >= 500)
    const out = applyFilterGroups(ds, [
      group('g1', [filter({ operator: 'contains', value: 'info' })]),
      group('g2', [filter({ columnKey: 'code', operator: 'gte', value: '500' })]),
    ]);
    expect(out).toEqual([0, 2, 3, 4]); // INFO rows 0,4 + code>=500 rows 2,3
  });

  it('ignores groups with no complete filters', () => {
    const out = applyFilterGroups(ds, [
      group('g1', [filter({ columnKey: 'code', operator: 'equals', value: '500' })]),
      group('g2', [filter({ operator: 'contains', value: '' })]), // incomplete → ignored
    ]);
    expect(out).toEqual([2]); // not all rows — the empty group doesn't widen to everything
  });
});

describe('isFilterComplete', () => {
  it('unary operators are always complete', () => {
    expect(isFilterComplete(filter({ operator: 'isEmpty', value: '' }))).toBe(true);
  });
  it('range operators need both operands', () => {
    expect(
      isFilterComplete(filter({ operator: 'between', value: '1', value2: '' })),
    ).toBe(false);
    expect(
      isFilterComplete(filter({ operator: 'between', value: '1', value2: '2' })),
    ).toBe(true);
  });
});
