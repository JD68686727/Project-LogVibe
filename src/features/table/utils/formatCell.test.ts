import { describe, it, expect } from 'vitest';
import { formatCell } from './formatCell';

describe('formatCell', () => {
  it('formats a date column in the given timezone', () => {
    expect(formatCell('2026-06-19T08:01:12Z', 'date', 'UTC').text).toBe(
      '2026-06-19 08:01:12',
    );
    expect(formatCell('2026-06-19T08:01:12Z', 'date', 'Europe/Berlin').text).toBe(
      '2026-06-19 10:01:12',
    );
  });

  it('defaults date formatting to UTC', () => {
    expect(formatCell('2026-06-19T08:01:12Z', 'date').text).toBe('2026-06-19 08:01:12');
  });

  it('leaves other types and empty cells untouched', () => {
    expect(formatCell(1234, 'number').align).toBe('right');
    expect(formatCell('hi', 'string').text).toBe('hi');
    expect(formatCell(null, 'date').muted).toBe(true);
  });
});
