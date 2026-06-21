// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useWorkspace } from './useWorkspace';
import { makeDataset } from '@/test/factory';

const dsA = makeDataset([{ name: 'a', type: 'string' }], [], { fileName: 'a.csv' });
const dsB = makeDataset([{ name: 'b', type: 'string' }], [], { fileName: 'b.csv' });

describe('useWorkspace', () => {
  it('has no active file when empty', () => {
    const { result } = renderHook(() => useWorkspace());
    expect(result.current.files).toHaveLength(0);
    expect(result.current.activeFile).toBeNull();
  });

  it('adds datasets and makes the newest one active', () => {
    const { result } = renderHook(() => useWorkspace());
    act(() => result.current.addDataset(dsA));
    expect(result.current.files).toHaveLength(1);
    expect(result.current.activeFile?.dataset).toBe(dsA);
    act(() => result.current.addDataset(dsB));
    expect(result.current.files).toHaveLength(2);
    expect(result.current.activeFile?.dataset).toBe(dsB);
  });

  it('setActive switches the active file', () => {
    const { result } = renderHook(() => useWorkspace());
    act(() => result.current.addDataset(dsA));
    const idA = result.current.files[0].id;
    act(() => result.current.addDataset(dsB));
    act(() => result.current.setActive(idA));
    expect(result.current.activeFile?.dataset).toBe(dsA);
  });

  it('removeFile falls back to a remaining file when the active one is removed', () => {
    const { result } = renderHook(() => useWorkspace());
    act(() => result.current.addDataset(dsA));
    act(() => result.current.addDataset(dsB));
    const idB = result.current.files[1].id; // currently active
    act(() => result.current.removeFile(idB));
    expect(result.current.files).toHaveLength(1);
    expect(result.current.activeFile?.dataset).toBe(dsA);
  });
});
