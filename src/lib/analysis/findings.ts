import type { Dataset } from '@/types/dataset';
import { assembleDataset } from '@/lib/csv/assembleDataset';

/** Ordered from most to least urgent — used for sorting and severity badges. */
export type Severity = 'critical' | 'high' | 'medium' | 'low';

/**
 * A single defensive-analysis result. The shared output "currency" of every
 * security module (threat scan, config audit, …) so they all funnel into the
 * same rendering + export surface via `findingsToDataset`.
 */
export interface Finding {
  severity: Severity;
  /** Id of the rule/profile that fired. */
  rule: string;
  /** The subject the finding is about — an IP, user, or config key. */
  entity: string;
  /** Human-readable explanation. */
  detail: string;
  /** How many events/occurrences back this finding (1 for single facts). */
  count: number;
  /** Optional MITRE ATT&CK reference, e.g. "T1110 · Brute Force". */
  technique?: string;
}

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** Most severe first, then most frequent, then by entity for stability. */
export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      b.count - a.count ||
      a.entity.localeCompare(b.entity),
  );
}

/**
 * Turns findings into a first-class `Dataset` so they inherit the entire
 * existing surface — table, filter, sort, and the redaction-aware export — for
 * free. This is the key reuse trick that keeps the security modules thin.
 */
export function findingsToDataset(findings: Finding[], fileName: string): Dataset {
  // Only threat-scan findings carry a technique — omit the column for audits
  // (and anything else) that never set one, keeping the schema tidy.
  const withTechnique = findings.some((f) => f.technique);
  const headers = withTechnique
    ? ['severity', 'rule', 'technique', 'entity', 'detail', 'count']
    : ['severity', 'rule', 'entity', 'detail', 'count'];
  const rows = sortFindings(findings).map((f) => {
    const base = [f.severity, f.rule];
    if (withTechnique) base.push(f.technique ?? '');
    base.push(f.entity, f.detail, String(f.count));
    return base;
  });
  return assembleDataset(headers, rows, {
    fileName,
    fileSize: 0,
    delimiter: ',',
    truncated: false,
  });
}
