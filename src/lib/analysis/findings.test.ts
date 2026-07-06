import { describe, it, expect } from 'vitest';
import { sortFindings, findingsToDataset, riskScore, type Finding } from './findings';

const F = (severity: Finding['severity'], entity: string, count = 1): Finding => ({
  severity,
  rule: 'r',
  entity,
  detail: 'd',
  count,
});

describe('riskScore', () => {
  it('weights by severity and scales (log10) with count', () => {
    expect(riskScore(F('critical', 'x'))).toBe(40); // 40 × (1 + log10(1))
    expect(riskScore(F('high', 'x', 10))).toBe(40); // 20 × (1 + 1)
    // A high-volume high out-scores a single critical.
    expect(riskScore(F('high', 'x', 100))).toBeGreaterThan(riskScore(F('critical', 'y')));
  });
});

describe('sortFindings', () => {
  it('orders by risk (severity × volume), most urgent first', () => {
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
      'risk',
    ]);
    expect(ds.meta.fileName).toBe('scan.csv');
    // count/risk columns infer as number; first row is the critical finding.
    expect(ds.rows[0][ds.columnIndex.severity]).toBe('critical');
    expect(ds.rows[0][ds.columnIndex.count]).toBe(1);
    expect(ds.rows[0][ds.columnIndex.risk]).toBe(40);
  });

  it('produces an empty dataset for no findings', () => {
    const ds = findingsToDataset([], 'scan.csv');
    expect(ds.rows).toHaveLength(0);
    expect(ds.columns).toHaveLength(6);
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
