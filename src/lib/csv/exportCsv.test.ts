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

  it('neutralizes spreadsheet formula injection, sparing plain numbers', () => {
    const inj = makeDataset(
      [
        { name: 'agent', type: 'string' },
        { name: 'delta', type: 'number' },
      ],
      [
        ['=HYPERLINK("http://evil","x")', -5], // formula → escaped; -5 stays a number
        ['@SUM(A1)', 3],
        ['-2+3+cmd|calc', 1], // non-numeric leading '-' → escaped
        ['plain', 0],
      ],
    );
    const rows = datasetToCsv(inj, [0, 1, 2, 3]).split(/\r?\n/);
    expect(rows[1]).toBe(`"'=HYPERLINK(""http://evil"",""x"")",-5`);
    expect(rows[2]).toBe(`'@SUM(A1),3`);
    expect(rows[3]).toBe(`'-2+3+cmd|calc,1`);
    expect(rows[4]).toBe('plain,0'); // untouched
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
