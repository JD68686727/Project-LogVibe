// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useColumnView } from './useColumnView';
import { makeDataset } from '@/test/factory';

const ds = makeDataset(
  [
    { name: 'Alpha', key: 'a', type: 'string' },
    { name: 'Beta', key: 'b', type: 'number' },
    { name: 'Gamma', key: 'c', type: 'string' },
  ],
  [],
);

describe('useColumnView', () => {
  it('starts with all columns visible in original order', () => {
    const { result } = renderHook(() => useColumnView(ds));
    expect(result.current.visible.map((c) => c.key)).toEqual(['a', 'b', 'c']);
    expect(result.current.items.map((i) => i.visible)).toEqual([true, true, true]);
  });

  it('toggles a column off and back on', () => {
    const { result } = renderHook(() => useColumnView(ds));
    act(() => result.current.toggle('b'));
    expect(result.current.visible.map((c) => c.key)).toEqual(['a', 'c']);
    act(() => result.current.toggle('b'));
    expect(result.current.visible.map((c) => c.key)).toEqual(['a', 'b', 'c']);
  });

  it('keeps at least one column visible', () => {
    const { result } = renderHook(() => useColumnView(ds));
    act(() => result.current.toggle('b'));
    act(() => result.current.toggle('c'));
    expect(result.current.visible.map((c) => c.key)).toEqual(['a']);
    act(() => result.current.toggle('a')); // would hide the last → no-op
    expect(result.current.visible.map((c) => c.key)).toEqual(['a']);
  });

  it('moves a column up/down and no-ops at the ends', () => {
    const { result } = renderHook(() => useColumnView(ds));
    act(() => result.current.move('c', 'up'));
    expect(result.current.visible.map((c) => c.key)).toEqual(['a', 'c', 'b']);
    act(() => result.current.move('a', 'up')); // already first
    expect(result.current.visible.map((c) => c.key)).toEqual(['a', 'c', 'b']);
  });

  it('applyView restores order/visibility, reconciled to the schema', () => {
    const { result } = renderHook(() => useColumnView(ds));
    act(() =>
      result.current.applyView([
        { key: 'c', visible: false },
        { key: 'a', visible: true },
        { key: 'gone', visible: true }, // unknown → dropped
        // 'b' omitted → appended visible
      ]),
    );
    expect(result.current.view).toEqual([
      { key: 'c', visible: false },
      { key: 'a', visible: true },
      { key: 'b', visible: true },
    ]);
    expect(result.current.visible.map((c) => c.key)).toEqual(['a', 'b']);
  });

  it('showAll re-shows everything; reset restores original order', () => {
    const { result } = renderHook(() => useColumnView(ds));
    act(() => result.current.toggle('a'));
    act(() => result.current.move('c', 'up'));
    act(() => result.current.showAll());
    expect(result.current.items.every((i) => i.visible)).toBe(true);
    act(() => result.current.reset());
    expect(result.current.view).toEqual([
      { key: 'a', visible: true },
      { key: 'b', visible: true },
      { key: 'c', visible: true },
    ]);
  });
});
