import { describe, it, expect } from 'vitest';
import { assembleDataset } from '@/lib/csv/assembleDataset';
import { deriveColumn, dropColumn } from './deriveColumn';

const ds = () =>
  assembleDataset(
    ['msg'],
    [['GET /api/x 200 512'], ['POST /login 403 88'], ['nope']],
    { fileName: 't.csv', fileSize: 0, delimiter: ',', truncated: false },
  );

describe('deriveColumn', () => {
  it('extracts a capture group into a new derived column', () => {
    const out = deriveColumn(ds(), {
      name: 'status',
      sourceKey: 'msg',
      pattern: '\\s(\\d{3})\\s',
    });
    const col = out.columns[out.columnIndex.status];
    expect(col.derived).toBe(true);
    expect(out.rows.map((r) => r[out.columnIndex.status])).toEqual([
      '200',
      '403',
      null, // no match → null
    ]);
  });

  it('coerces to a number type via coerceValue', () => {
    const out = deriveColumn(ds(), {
      name: 'status',
      sourceKey: 'msg',
      pattern: '\\s(\\d{3})\\s',
      type: 'number',
    });
    expect(out.columns[out.columnIndex.status].type).toBe('number');
    expect(out.rows[0][out.columnIndex.status]).toBe(200);
  });

  it('takes the whole match when group is 0', () => {
    const out = deriveColumn(ds(), {
      name: 'verb',
      sourceKey: 'msg',
      pattern: '^\\w+',
      group: 0,
    });
    expect(out.rows.map((r) => r[out.columnIndex.verb])).toEqual([
      'GET',
      'POST',
      'nope',
    ]);
  });

  it('de-dupes the key against an existing column', () => {
    const out = deriveColumn(ds(), { name: 'Msg', sourceKey: 'msg', pattern: '(x)' });
    // 'msg' is taken → slug becomes 'msg_2'
    expect(out.columns.map((c) => c.key)).toEqual(['msg', 'msg_2']);
  });

  it('throws on an invalid regex (caller guards)', () => {
    expect(() => deriveColumn(ds(), { name: 'x', sourceKey: 'msg', pattern: '(' })).toThrow();
  });

  it('is a no-op for an unknown source column', () => {
    const d = ds();
    expect(deriveColumn(d, { name: 'x', sourceKey: 'nope', pattern: '(.)' })).toBe(d);
  });
});

describe('dropColumn', () => {
  it('removes a column, its cells, and reindexes', () => {
    const withCol = deriveColumn(ds(), {
      name: 'status',
      sourceKey: 'msg',
      pattern: '\\s(\\d{3})\\s',
    });
    const out = dropColumn(withCol, 'status');
    expect(out.columns.map((c) => c.key)).toEqual(['msg']);
    expect(out.columnIndex).toEqual({ msg: 0 });
    expect(out.rows.every((r) => r.length === 1)).toBe(true);
  });

  it('reindexes when dropping a middle column', () => {
    const two = deriveColumn(
      deriveColumn(ds(), { name: 'a', sourceKey: 'msg', pattern: '(\\d{3})' }),
      { name: 'b', sourceKey: 'msg', pattern: '(\\w+)' },
    );
    const out = dropColumn(two, 'a');
    expect(out.columns.map((c) => c.key)).toEqual(['msg', 'b']);
    expect(out.columnIndex).toEqual({ msg: 0, b: 1 });
  });

  it('is a no-op for an unknown key', () => {
    const d = ds();
    expect(dropColumn(d, 'nope')).toBe(d);
  });
});
