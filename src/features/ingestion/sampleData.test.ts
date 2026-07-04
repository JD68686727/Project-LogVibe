import { describe, it, expect } from 'vitest';
import { SAMPLES, sampleToFile } from './sampleData';

describe('sampleData', () => {
  it('bundles non-empty CSV samples', () => {
    expect(SAMPLES.length).toBeGreaterThan(0);
    for (const s of SAMPLES) {
      expect(s.fileName).toMatch(/\.csv$/);
      expect(s.content).toContain(','); // has CSV columns
      expect(s.content.trim().length).toBeGreaterThan(0);
    }
  });

  it('wraps a sample as a text/csv File named after the sample', () => {
    const f = sampleToFile(SAMPLES[0]);
    expect(f.name).toBe(SAMPLES[0].fileName);
    expect(f.type).toBe('text/csv');
  });
});
