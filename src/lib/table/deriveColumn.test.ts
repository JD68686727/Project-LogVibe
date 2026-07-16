import { describe, it, expect } from 'vitest';
import { assembleDataset } from '@/lib/csv/assembleDataset';
import { deriveColumn, dropColumn, recomputeDerived } from './deriveColumn';

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

  it('is a no-op for an invalid regex (never throws — untrusted specs are safe)', () => {
    const d = ds();
    const out = deriveColumn(d, { name: 'x', sourceKey: 'msg', pattern: '(' });
    expect(out).toBe(d); // dataset unchanged, no column added
  });

  it('sanitizes flags so a `g` flag still extracts the capture group', () => {
    // With a raw `g` flag, String.match returns all matches and drops groups;
    // sanitizeFlags strips it, so group 1 is still extracted per row.
    const out = deriveColumn(ds(), {
      name: 'status',
      sourceKey: 'msg',
      pattern: '(\\d{3})',
      flags: 'gi',
    });
    expect(out.rows[0][out.columnIndex.status]).toBe('200');
  });

  it('is a no-op for an unknown source column', () => {
    const d = ds();
    expect(deriveColumn(d, { name: 'x', sourceKey: 'nope', pattern: '(.)' })).toBe(d);
  });
});

const numDs = () =>
  assembleDataset(
    ['latency_ms', 'bytes'],
    [
      ['1000', '200'],
      ['500', '0'],
      ['x', '10'],
    ],
    { fileName: 't.csv', fileSize: 0, delimiter: ',', truncated: false },
  );

describe('deriveColumn (arithmetic)', () => {
  it('divides a column by a numeric literal', () => {
    const out = deriveColumn(numDs(), {
      kind: 'arithmetic',
      name: 'latency_s',
      left: 'latency_ms',
      op: '/',
      right: '1000',
    });
    expect(out.columns[out.columnIndex.latency_s].type).toBe('number');
    expect(out.rows.map((r) => r[out.columnIndex.latency_s])).toEqual([
      1, // 1000/1000
      0.5, // 500/1000
      null, // 'x' is non-numeric
    ]);
  });

  it('combines two columns', () => {
    const out = deriveColumn(numDs(), {
      kind: 'arithmetic',
      name: 'sum',
      left: 'latency_ms',
      op: '+',
      right: 'bytes',
    });
    expect(out.rows[0][out.columnIndex.sum]).toBe(1200);
  });

  it('returns null on divide-by-zero', () => {
    const out = deriveColumn(numDs(), {
      kind: 'arithmetic',
      name: 'ratio',
      left: 'latency_ms',
      op: '/',
      right: 'bytes',
    });
    expect(out.rows[1][out.columnIndex.ratio]).toBe(null); // 500/0
  });
});

const pairDs = () =>
  assembleDataset(
    ['host', 'port'],
    [
      ['10.0.0.1', '443'],
      ['10.0.0.2', ''],
    ],
    { fileName: 't.csv', fileSize: 0, delimiter: ',', truncated: false },
  );

describe('deriveColumn (concat)', () => {
  it('fills a template with column placeholders (by key)', () => {
    const out = deriveColumn(pairDs(), {
      kind: 'concat',
      name: 'endpoint',
      template: '{host}:{port}',
    });
    expect(out.rows.map((r) => r[out.columnIndex.endpoint])).toEqual([
      '10.0.0.1:443',
      '10.0.0.2:', // null port → empty
    ]);
  });

  it('resolves placeholders by header name and leaves unknown ones literal', () => {
    const out = deriveColumn(pairDs(), {
      kind: 'concat',
      name: 'label',
      template: '{host} [{missing}]',
    });
    expect(out.rows[0][out.columnIndex.label]).toBe('10.0.0.1 [{missing}]');
  });
});

describe('recomputeDerived', () => {
  it('refreshes derived cells for rows added after the column was created', () => {
    // Simulate a tailed dataset: derive a column, then append a row and
    // recompute — the new row must get a real value, not null.
    const withCol = deriveColumn(ds(), {
      name: 'status',
      sourceKey: 'msg',
      pattern: '\\s(\\d{3})\\s',
    });
    // Append a raw row that only has the base column (as live-tail would).
    const appended = {
      ...withCol,
      rows: [...withCol.rows, ['DELETE /x 204 0', null]], // derived cell null
    };
    const out = recomputeDerived(appended, [
      { name: 'status', sourceKey: 'msg', pattern: '\\s(\\d{3})\\s' },
    ]);
    expect(out.rows.map((r) => r[out.columnIndex.status])).toEqual([
      '200',
      '403',
      null, // original no-match row
      '204', // the appended row now computed
    ]);
    // Column count is unchanged (dropped + re-added, not duplicated).
    expect(out.columns.map((c) => c.key)).toEqual(['msg', 'status']);
  });

  it('is a no-op with no specs', () => {
    const d = ds();
    expect(recomputeDerived(d, [])).toBe(d);
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
