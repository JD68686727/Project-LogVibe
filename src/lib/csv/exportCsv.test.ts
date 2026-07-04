import { describe, it, expect } from 'vitest';
import { datasetToCsv } from './exportCsv';
import { makeDataset } from '@/test/factory';

const ds = makeDataset(
  [
    { name: 'level', type: 'string' },
    { name: 'code', type: 'number' },
    { name: 'note', type: 'string' },
  ],
  [
    ['INFO', 200, 'plain'],
    ['WARN', 404, 'has, comma'],
    ['ERROR', null, 'with "quote"'],
  ],
);

describe('datasetToCsv', () => {
  it('writes the header from column names', () => {
    const lines = datasetToCsv(ds, [0]).split(/\r?\n/);
    expect(lines[0]).toBe('level,code,note');
  });

  it('emits raw values, with null as an empty field', () => {
    const lines = datasetToCsv(ds, [2]).split(/\r?\n/);
    expect(lines[1]).toBe('ERROR,,"with ""quote"""');
  });

  it('quotes fields containing the delimiter', () => {
    const lines = datasetToCsv(ds, [1]).split(/\r?\n/);
    expect(lines[1]).toBe('WARN,404,"has, comma"');
  });

  it('exports only the rows in the given order, in that order', () => {
    const lines = datasetToCsv(ds, [2, 0]).split(/\r?\n/);
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[1].startsWith('ERROR')).toBe(true);
    expect(lines[2].startsWith('INFO')).toBe(true);
  });

  it('reformats date columns into the given timezone, leaving others raw', () => {
    const dds = makeDataset(
      [
        { name: 'ts', type: 'date' },
        { name: 'level', type: 'string' },
      ],
      [['2026-06-19T08:00:00Z', 'INFO']],
    );
    // +2h in Berlin (June/CEST); the string column is untouched.
    const withTz = datasetToCsv(dds, [0], dds.columns, undefined, 'Europe/Berlin');
    expect(withTz.split(/\r?\n/)[1]).toBe('2026-06-19 10:00:00,INFO');
    // Without a tz, the raw timestamp is preserved.
    expect(datasetToCsv(dds, [0]).split(/\r?\n/)[1]).toBe('2026-06-19T08:00:00Z,INFO');
  });
});
