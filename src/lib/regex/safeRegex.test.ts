import { describe, it, expect } from 'vitest';
import { sanitizeFlags, isLikelyCatastrophic, safeRegExp } from './safeRegex';

describe('sanitizeFlags', () => {
  it('keeps imsu, drops g/y and junk', () => {
    expect(sanitizeFlags('gimsuy')).toBe('imsu');
    expect(sanitizeFlags('gy')).toBe('');
    expect(sanitizeFlags('iiz')).toBe('i');
    expect(sanitizeFlags(undefined)).toBe('');
  });
});

describe('isLikelyCatastrophic', () => {
  it('flags star-height ≥ 2 (nested unbounded quantifiers)', () => {
    for (const p of ['(a+)+', '(a*)*', '(a+)*', '([a-z]+)+', '(\\d+)*$', '((ab)+)+']) {
      expect(isLikelyCatastrophic(p)).toBe(true);
    }
  });

  it('leaves normal patterns alone', () => {
    for (const p of [
      '\\d{3}',
      '^/api/(\\w+)',
      '[45]\\d{2}',
      '(foo|bar)',
      'a+b*c?',
      '(\\d+)', // single quantifier in a group is fine
      '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b', // the IPv4 quick-pattern
    ]) {
      expect(isLikelyCatastrophic(p)).toBe(false);
    }
  });

  it('is not fooled by escaped parens/quantifiers or char classes', () => {
    expect(isLikelyCatastrophic('\\(a+\\)+')).toBe(false); // literal parens
    expect(isLikelyCatastrophic('[()+*]+')).toBe(false); // symbols in a class
  });
});

describe('safeRegExp', () => {
  it('compiles a valid pattern with sanitized flags', () => {
    const re = safeRegExp('(\\d+)', 'gi');
    expect(re).toBeInstanceOf(RegExp);
    expect(re?.flags).toBe('i'); // g dropped
  });

  it('returns null for invalid or catastrophic patterns', () => {
    expect(safeRegExp('(')).toBeNull();
    expect(safeRegExp('(a+)+')).toBeNull();
  });
});
