import { describe, it, expect } from 'vitest';
import { assembleDataset } from './assembleDataset';

describe('assembleDataset', () => {
  it('infers columns, normalizes keys, and coerces cells', () => {
    const ds = assembleDataset(
      ['Time Stamp', 'level', 'count'],
      [
        ['2026-01-01T00:00:00', 'INFO', '5'],
        ['2026-01-01T00:00:01', 'WARN', ''],
      ],
      { fileName: 'a.log', fileSize: 42, delimiter: '', truncated: false },
    );

    expect(ds.columns.map((c) => c.key)).toEqual(['time_stamp', 'level', 'count']);
    expect(ds.columns[0].type).toBe('date');
    expect(ds.columns[2].type).toBe('number');
    expect(ds.columnIndex.level).toBe(1);

    expect(ds.rows[0][2]).toBe(5); // coerced number
    expect(ds.rows[1][2]).toBeNull(); // '' → null
    expect(ds.meta).toMatchObject({ fileName: 'a.log', rowCount: 2, truncated: false });
  });
});
