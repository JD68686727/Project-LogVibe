// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getTailKeepLast, setTailKeepLast } from './tailBufferStore';

beforeEach(() => localStorage.clear());

describe('tailBufferStore', () => {
  it('defaults to null (unlimited) when unset', () => {
    expect(getTailKeepLast()).toBeNull();
  });

  it('round-trips a positive window', () => {
    setTailKeepLast(100_000);
    expect(getTailKeepLast()).toBe(100_000);
  });

  it('treats 0 / non-positive as unlimited (null)', () => {
    setTailKeepLast(0);
    expect(getTailKeepLast()).toBeNull();
    setTailKeepLast(-5);
    expect(getTailKeepLast()).toBeNull();
  });

  it('degrades to null on corrupt storage', () => {
    localStorage.setItem('logvibe.tailKeepLast', 'nope');
    expect(getTailKeepLast()).toBeNull();
  });
});
