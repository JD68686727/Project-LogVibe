// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { makeDataset } from '@/test/factory';
import type { DerivedSpec } from '@/lib/table/deriveColumn';
import {
  getDerivedSpecs,
  addDerivedSpec,
  removeDerivedSpec,
} from './derivedColumnStore';

const ds = makeDataset(
  [
    { name: 'msg', key: 'msg', type: 'string' },
    { name: 'port', key: 'port', type: 'string' },
  ],
  [],
);
const other = makeDataset([{ name: 'x', key: 'x', type: 'string' }], []);

const extract: DerivedSpec = { name: 'status', sourceKey: 'msg', pattern: '(\\d+)' };
const math: DerivedSpec = { kind: 'arithmetic', name: 'p2', left: 'port', op: '*', right: '2' };

beforeEach(() => localStorage.clear());

describe('derivedColumnStore', () => {
  it('round-trips specs per structure, preserving order', () => {
    expect(getDerivedSpecs(ds)).toEqual([]);
    addDerivedSpec(ds, 'status', extract);
    addDerivedSpec(ds, 'p2', math);
    expect(getDerivedSpecs(ds)).toEqual([extract, math]);
    expect(getDerivedSpecs(other)).toEqual([]); // isolated by structure
  });

  it('keys by BASE columns only (stable as derived columns are added)', () => {
    addDerivedSpec(ds, 'status', extract);
    // A dataset that already has a derived column resolves the same entry.
    const withDerived = makeDataset(
      [
        { name: 'msg', key: 'msg', type: 'string' },
        { name: 'port', key: 'port', type: 'string' },
        { name: 'status', key: 'status', type: 'string', derived: true },
      ],
      [],
    );
    expect(getDerivedSpecs(withDerived)).toEqual([extract]);
  });

  it('removes a spec by key and drops the empty entry', () => {
    addDerivedSpec(ds, 'status', extract);
    addDerivedSpec(ds, 'p2', math);
    removeDerivedSpec(ds, 'status');
    expect(getDerivedSpecs(ds)).toEqual([math]);
    removeDerivedSpec(ds, 'p2');
    expect(getDerivedSpecs(ds)).toEqual([]);
  });

  it('degrades to empty on corrupt storage', () => {
    localStorage.setItem('logvibe.derived.v1', 'nope');
    expect(getDerivedSpecs(ds)).toEqual([]);
  });
});
