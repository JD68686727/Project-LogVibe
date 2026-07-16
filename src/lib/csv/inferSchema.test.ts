import { describe, it, expect } from 'vitest';
import { classify, inferSchema } from './inferSchema';

describe('classify', () => {
  it('detects booleans (true/false/yes/no) before numbers', () => {
    expect(classify('true')).toBe('boolean');
    expect(classify('FALSE')).toBe('boolean');
    expect(classify('yes')).toBe('boolean');
  });

  it('treats 0/1 as numbers, not booleans', () => {
    expect(classify('0')).toBe('number');
    expect(classify('1')).toBe('number');
  });

  it('detects numbers and ISO-ish dates', () => {
    expect(classify('200')).toBe('number');
    expect(classify('-3.14')).toBe('number');
    expect(classify('2026-06-19')).toBe('date');
    expect(classify('2026-06-19T08:01:12')).toBe('date');
  });

  it('falls back to string for empty or free text', () => {
    expect(classify('')).toBe('string');
    expect(classify('/api/users')).toBe('string');
  });
});

describe('inferSchema', () => {
  it('picks the majority type per column from a sample', () => {
    const cols = inferSchema(
      ['ts', 'level', 'code'],
      [
        ['2026-06-19T08:00', 'INFO', '200'],
        ['2026-06-19T08:01', 'WARN', '404'],
      ],
    );
    expect(cols.map((c) => c.type)).toEqual(['date', 'string', 'number']);
  });

  it('defaults an all-empty column to string', () => {
    const [col] = inferSchema(['blank'], [[''], ['']]);
    expect(col.type).toBe('string');
  });

  it('types a column whose values start after the first rows (non-empty sampling)', () => {
    // Empty for the first 60 rows, then numeric — must still infer `number`.
    const rows = [
      ...Array.from({ length: 60 }, () => ['']),
      ['200'],
      ['404'],
      ['500'],
    ];
    const [col] = inferSchema(['code'], rows);
    expect(col.type).toBe('number');
  });

  it('normalizes headers into keys', () => {
    const [col] = inferSchema(['Status Code'], [['200']]);
    expect(col.key).toBe('status_code');
    expect(col.name).toBe('Status Code');
  });
});
