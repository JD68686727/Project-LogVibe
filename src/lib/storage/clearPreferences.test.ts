// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { clearSavedPreferences, savedPreferenceCount } from './clearPreferences';

beforeEach(() => localStorage.clear());

describe('clearPreferences', () => {
  it('clears only logvibe.* keys, leaving others intact', () => {
    localStorage.setItem('logvibe.theme', 'dark');
    localStorage.setItem('logvibe.derived.v1', '{}');
    localStorage.setItem('unrelated', 'keep');

    expect(savedPreferenceCount()).toBe(2);
    expect(clearSavedPreferences()).toBe(2);
    expect(savedPreferenceCount()).toBe(0);
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });

  it('is a no-op when nothing is stored', () => {
    expect(clearSavedPreferences()).toBe(0);
  });
});
