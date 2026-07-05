import { describe, it, expect } from 'vitest';
import { splitAppended } from './splitAppended';

describe('splitAppended', () => {
  it('returns complete lines and buffers a trailing partial', () => {
    expect(splitAppended('', 'a\nb\n')).toEqual({ lines: ['a', 'b'], remainder: '' });
    expect(splitAppended('', 'a\nb')).toEqual({ lines: ['a'], remainder: 'b' });
  });

  it('joins the previous remainder with the next chunk', () => {
    const first = splitAppended('', 'a\npar');
    expect(first).toEqual({ lines: ['a'], remainder: 'par' });
    const second = splitAppended(first.remainder, 'tial\nb\n');
    expect(second).toEqual({ lines: ['partial', 'b'], remainder: '' });
  });

  it('handles CRLF and drops blank lines', () => {
    expect(splitAppended('', '\r\nx\r\n\r\ny\r\n')).toEqual({
      lines: ['x', 'y'],
      remainder: '',
    });
  });

  it('is a no-op for empty input', () => {
    expect(splitAppended('', '')).toEqual({ lines: [], remainder: '' });
  });
});
