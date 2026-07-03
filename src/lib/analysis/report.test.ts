import { describe, it, expect } from 'vitest';
import { findingsToMarkdown } from './report';
import type { Finding } from './findings';

const AT = new Date('2026-07-03T21:15:00Z');

const FINDINGS: Finding[] = [
  {
    severity: 'medium',
    rule: 'http-error-burst',
    entity: '45.9.1.7',
    detail: '7 HTTP 4xx/5xx responses',
    count: 7,
    technique: 'T1595 · Active Scanning',
  },
  {
    severity: 'high',
    rule: 'brute-force',
    entity: '10.0.0.66',
    detail: '6 failed attempts within 51s',
    count: 6,
    technique: 'T1110 · Brute Force',
  },
];

describe('findingsToMarkdown', () => {
  it('renders a titled report with a severity summary', () => {
    const md = findingsToMarkdown(FINDINGS, { source: 'auth.csv', generatedAt: AT });
    expect(md).toContain('# Security Report — auth.csv');
    expect(md).toContain('Generated 2026-07-03 21:15 UTC');
    expect(md).toContain('| High | 1 |');
    expect(md).toContain('| Medium | 1 |');
  });

  it('groups by rule worst-first, with the technique in the heading', () => {
    const md = findingsToMarkdown(FINDINGS, { source: 'auth.csv', generatedAt: AT });
    // brute-force (high) group appears before http-error-burst (medium).
    expect(md.indexOf('brute-force')).toBeLessThan(md.indexOf('http-error-burst'));
    expect(md).toContain('### brute-force — T1110 · Brute Force');
    expect(md).toContain('- **[high]** `10.0.0.66` — 6 failed attempts within 51s');
  });

  it('applies labelFor and redact', () => {
    const md = findingsToMarkdown(FINDINGS, { source: 'auth.csv', generatedAt: AT }, {
      labelFor: (id) => (id === 'brute-force' ? 'Brute-force login attempts' : id),
      redact: (t) => t.replace(/\d+\.\d+\.\d+\.\d+/g, '[IP]'),
    });
    expect(md).toContain('### Brute-force login attempts — T1110 · Brute Force');
    expect(md).toContain('`[IP]`');
    expect(md).not.toContain('10.0.0.66');
  });

  it('handles no findings', () => {
    const md = findingsToMarkdown([], { source: 'clean.csv', generatedAt: AT });
    expect(md).toContain('_No findings._');
    expect(md).toContain('| Critical | 0 |');
  });
});
