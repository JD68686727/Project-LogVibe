import { describe, it, expect } from 'vitest';
import type { CompareConfig } from '@/types/compare';
import { buildComparison } from './buildComparison';
import { makeDataset, allRows } from '@/test/factory';

const fileA = makeDataset(
  [
    { name: 'level', type: 'string' },
    { name: 'latency', type: 'number' },
  ],
  [
    ['INFO', 10],
    ['INFO', 20],
    ['ERROR', 100],
  ],
);
const fileB = makeDataset(
  [
    { name: 'level', type: 'string' },
    { name: 'latency', type: 'number' },
  ],
  [
    ['INFO', 5],
    ['WARN', 50], // category present only in B
  ],
);

const cfg = (over: Partial<CompareConfig>): CompareConfig => ({
  type: 'bar',
  dimensionKey: 'level',
  measureKey: null,
  aggregation: 'count',
  bucket: 'none',
  fileIds: [],
  ...over,
});

describe('buildComparison', () => {
  it('aligns each file as a series keyed by category', () => {
    const res = buildComparison(
      [
        { label: 'A', dataset: fileA, order: allRows(fileA) },
        { label: 'B', dataset: fileB, order: allRows(fileB) },
      ],
      cfg({ aggregation: 'count' }),
    );
    expect(res.seriesLabels).toEqual(['A', 'B']);
    const byName = Object.fromEntries(res.data.map((r) => [r.name, r]));
    expect(byName.INFO).toEqual({ name: 'INFO', A: 2, B: 1 });
    expect(byName.ERROR).toEqual({ name: 'ERROR', A: 1, B: 0 });
  });

  it('fills 0 for categories absent in a file (union of categories)', () => {
    const res = buildComparison(
      [
        { label: 'A', dataset: fileA, order: allRows(fileA) },
        { label: 'B', dataset: fileB, order: allRows(fileB) },
      ],
      cfg({ aggregation: 'count' }),
    );
    const warn = res.data.find((r) => r.name === 'WARN')!;
    expect(warn).toEqual({ name: 'WARN', A: 0, B: 1 }); // A has no WARN → 0; B counts 1
  });

  it('orders bar categories by cross-file total descending', () => {
    const res = buildComparison(
      [
        { label: 'A', dataset: fileA, order: allRows(fileA) },
        { label: 'B', dataset: fileB, order: allRows(fileB) },
      ],
      cfg({ type: 'bar', aggregation: 'count' }),
    );
    // totals: INFO=3, ERROR=1, WARN=1 → INFO first
    expect(res.data[0].name).toBe('INFO');
    expect(res.groupCount).toBe(3);
  });

  it('aggregates a shared numeric measure per file', () => {
    const res = buildComparison(
      [
        { label: 'A', dataset: fileA, order: allRows(fileA) },
        { label: 'B', dataset: fileB, order: allRows(fileB) },
      ],
      cfg({ aggregation: 'avg', measureKey: 'latency' }),
    );
    const info = res.data.find((r) => r.name === 'INFO')!;
    expect(info.A).toBe(15); // (10+20)/2
    expect(info.B).toBe(5);
  });

  it('time-sync: a per-file offset aligns a clock skew into the same bucket', () => {
    const a = makeDataset(
      [{ name: 'ts', type: 'date' }],
      [['2026-06-19T08:10:00Z'], ['2026-06-19T08:50:00Z']],
    );
    // B's clock runs 1 hour behind A.
    const b = makeDataset(
      [{ name: 'ts', type: 'date' }],
      [['2026-06-19T07:10:00Z'], ['2026-06-19T07:50:00Z']],
    );
    const config = cfg({ dimensionKey: 'ts', bucket: 'hour' });

    // No offset → A in the 08:00 bucket, B in 07:00: two distinct categories.
    const before = buildComparison(
      [
        { label: 'A', dataset: a, order: allRows(a) },
        { label: 'B', dataset: b, order: allRows(b) },
      ],
      config,
      'UTC',
    );
    expect(before.groupCount).toBe(2);

    // +3600s on B pulls it forward into 08:00: one aligned category.
    const after = buildComparison(
      [
        { label: 'A', dataset: a, order: allRows(a) },
        { label: 'B', dataset: b, order: allRows(b), offsetMs: 3_600_000 },
      ],
      config,
      'UTC',
    );
    expect(after.groupCount).toBe(1);
    expect(after.data[0]).toEqual({ name: '2026-06-19 08:00', A: 2, B: 2 });
  });

  it("respects each file's per-file order (filtered subset)", () => {
    // Only count fileA's ERROR row (index 2); fileB unfiltered.
    const res = buildComparison(
      [
        { label: 'A', dataset: fileA, order: [2] },
        { label: 'B', dataset: fileB, order: allRows(fileB) },
      ],
      cfg({ aggregation: 'count' }),
    );
    const byName = Object.fromEntries(res.data.map((r) => [r.name, r]));
    expect(byName.ERROR).toEqual({ name: 'ERROR', A: 1, B: 0 });
    expect(byName.INFO).toEqual({ name: 'INFO', A: 0, B: 1 }); // A's INFO rows excluded
  });
});
