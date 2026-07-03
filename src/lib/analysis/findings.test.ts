import { describe, it, expect } from 'vitest';
import { sortFindings, findingsToDataset, type Finding } from './findings';

const F = (severity: Finding['severity'], entity: string, count = 1): Finding => ({
  severity,
  rule: 'r',
  entity,
  detail: 'd',
  count,
});

describe('sortFindings', () => {
  it('orders by severity, then count desc', () => {
    const out = sortFindings([
      F('low', 'a'),
      F('critical', 'b'),
      F('high', 'c', 2),
      F('high', 'd', 9),
    ]);
    expect(out.map((f) => f.entity)).toEqual(['b', 'd', 'c', 'a']);
  });
});

describe('findingsToDataset', () => {
  it('builds a typed dataset with a stable column order, sorted by severity', () => {
    const ds = findingsToDataset([F('low', 'a'), F('critical', 'b')], 'scan.csv');
    expect(ds.columns.map((c) => c.key)).toEqual([
      'severity',
      'rule',
      'entity',
      'detail',
      'count',
    ]);
    expect(ds.meta.fileName).toBe('scan.csv');
    // count column infers as number; first row is the critical finding.
    expect(ds.rows[0][ds.columnIndex.severity]).toBe('critical');
    expect(ds.rows[0][ds.columnIndex.count]).toBe(1);
  });

  it('produces an empty dataset for no findings', () => {
    const ds = findingsToDataset([], 'scan.csv');
    expect(ds.rows).toHaveLength(0);
    expect(ds.columns).toHaveLength(5);
  });

  it('adds a technique column only when a finding carries one', () => {
    const withTech = findingsToDataset(
      [{ ...F('high', 'a'), technique: 'T1110 · Brute Force' }],
      'scan.csv',
    );
    expect(withTech.columns.map((c) => c.key)).toContain('technique');
    expect(withTech.rows[0][withTech.columnIndex.technique]).toBe(
      'T1110 · Brute Force',
    );

    // Findings without a technique keep the tidy 5-column schema.
    const noTech = findingsToDataset([F('high', 'a')], 'scan.csv');
    expect(noTech.columns.map((c) => c.key)).not.toContain('technique');
  });
});
