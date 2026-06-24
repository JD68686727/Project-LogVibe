import { describe, it, expect } from 'vitest';
import type { ViewState } from '@/types/share';
import { decodeView, encodeView } from './encodeView';

const view: ViewState = {
  filters: [
    { id: 'f1', columnKey: 'status_code', operator: 'gte', value: '500' },
  ],
  query: 'payments',
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

  it('leaves pivot undefined for a legacy token without one', () => {
    const { filters, query, sort, chart, columns } = view;
    const legacy = { filters, query, sort, chart, columns };
    expect(decodeView(btoaSafe(JSON.stringify(legacy)))?.pivot).toBeUndefined();
  });
});

// Local helper mirroring the encoder's base64url, to craft test tokens.
function btoaSafe(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
