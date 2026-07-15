import { describe, it, expect } from 'vitest';
import type { ViewState } from '@/types/share';
import { decodeView, encodeView } from './encodeView';

const view: ViewState = {
  groups: [
    {
      id: 'g1',
      filters: [
        { id: 'f1', columnKey: 'status_code', operator: 'gte', value: '500' },
      ],
    },
  ],
  query: 'payments',
  searchRegex: true,
  sort: [{ columnKey: 'latency', direction: 'desc' }],
  chart: {
    type: 'bar',
    dimensionKey: 'level',
    measureKey: null,
    aggregation: 'count',
    bucket: 'none',
  },
  columns: [
    { key: 'level', visible: true },
    { key: 'cached', visible: false },
  ],
  pivot: {
    rowKey: 'level',
    colKey: 'cached',
    aggregation: 'avg',
    measureKey: 'latency',
  },
};

describe('encodeView / decodeView', () => {
  it('round-trips a view through a URL-safe token', () => {
    const token = encodeView(view);
    expect(token).not.toMatch(/[+/=]/); // url-safe, unpadded
    expect(decodeView(token)).toEqual(view);
  });

  it('round-trips unicode in values', () => {
    const v: ViewState = { ...view, query: 'café — naïve 你好' };
    expect(decodeView(encodeView(v))?.query).toBe('café — naïve 你好');
  });

  it('returns null for a malformed token', () => {
    expect(decodeView('not-valid-base64!!!')).toBeNull();
    expect(decodeView(btoaSafe('{"not":"a view"}'))).toBeNull();
  });

  it('returns null for valid JSON that is not a view', () => {
    expect(decodeView(btoaSafe('[1,2,3]'))).toBeNull();
  });

  it('decodes a legacy single-sort token to a one-element array', () => {
    const legacy = { ...view, sort: { columnKey: 'level', direction: 'asc' } };
    expect(decodeView(btoaSafe(JSON.stringify(legacy)))?.sort).toEqual([
      { columnKey: 'level', direction: 'asc' },
    ]);
  });

  it('round-trips computed-column recipes (all three kinds)', () => {
    const v: ViewState = {
      ...view,
      derived: [
        { name: 'status', sourceKey: 'msg', pattern: '(\\d+)' },
        { kind: 'arithmetic', name: 'p2', left: 'port', op: '*', right: '2' },
        { kind: 'concat', name: 'who', template: '{ip}:{port}' },
      ],
    };
    expect(decodeView(encodeView(v))?.derived).toEqual(v.derived);
  });

  it('drops malformed derived specs and leaves an empty list undefined', () => {
    const bad = {
      ...view,
      derived: [
        { name: 'ok', sourceKey: 'msg', pattern: '(x)' },
        { name: 'no-source' }, // missing extract fields
        { kind: 'arithmetic', name: 'bad-op', left: 'a', op: '%', right: 'b' },
      ],
    };
    expect(decodeView(btoaSafe(JSON.stringify(bad)))?.derived).toEqual([
      { name: 'ok', sourceKey: 'msg', pattern: '(x)' },
    ]);

    const none = { ...view, derived: [{ name: 'x' }] };
    expect(decodeView(btoaSafe(JSON.stringify(none)))?.derived).toBeUndefined();
  });

  it('drops a derived spec whose regex would not compile', () => {
    const bad = {
      ...view,
      derived: [
        { name: 'ok', sourceKey: 'msg', pattern: '(\\d+)' },
        { name: 'broken', sourceKey: 'msg', pattern: '(' }, // invalid regex
      ],
    };
    expect(decodeView(btoaSafe(JSON.stringify(bad)))?.derived).toEqual([
      { name: 'ok', sourceKey: 'msg', pattern: '(\\d+)' },
    ]);
  });

  it('filters malformed column items instead of crashing on apply', () => {
    const hostile = {
      ...view,
      columns: [null, { key: 'level', visible: true }, { key: 5, visible: true }, 'x'],
    };
    expect(decodeView(btoaSafe(JSON.stringify(hostile)))?.columns).toEqual([
      { key: 'level', visible: true },
    ]);
  });

  it('rebuilds a safe chart from a malformed one (defaults, no crash)', () => {
    const hostile = { ...view, chart: { type: 'evil', aggregation: 'drop' } };
    expect(decodeView(btoaSafe(JSON.stringify(hostile)))?.chart).toEqual({
      type: 'bar',
      dimensionKey: '',
      measureKey: null,
      aggregation: 'count',
      bucket: 'none',
    });
  });

  it('leaves pivot undefined for a legacy token without one', () => {
    const { groups, query, sort, chart, columns } = view;
    const legacy = { groups, query, sort, chart, columns };
    expect(decodeView(btoaSafe(JSON.stringify(legacy)))?.pivot).toBeUndefined();
  });

  it('wraps a legacy flat-filters token into a single group', () => {
    const legacy = {
      query: '',
      sort: [],
      chart: view.chart,
      columns: view.columns,
      filters: [{ id: 'f1', columnKey: 'level', operator: 'equals', value: 'INFO' }],
    };
    expect(decodeView(btoaSafe(JSON.stringify(legacy)))?.groups).toEqual([
      {
        id: expect.any(String),
        filters: [
          { id: 'f1', columnKey: 'level', operator: 'equals', value: 'INFO' },
        ],
      },
    ]);
  });
});

// Local helper mirroring the encoder's base64url, to craft test tokens.
function btoaSafe(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
