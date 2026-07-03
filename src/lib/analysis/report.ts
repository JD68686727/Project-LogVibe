import { sortFindings, type Finding, type Severity } from './findings';

export interface ReportMeta {
  /** Source file the findings came from. */
  source: string;
  /** Defaults to now; injectable for deterministic output. */
  generatedAt?: Date;
}

export interface ReportOptions {
  /** Friendly heading per rule id (defaults to the raw id). */
  labelFor?: (ruleId: string) => string;
  /** Optional anonymizer applied to entity/detail text (e.g. IP → [IP_1]). */
  redact?: (text: string) => string;
}

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Renders findings as a self-contained Markdown report — a severity summary plus
 * findings grouped by rule (with the ATT&CK technique in the heading when set).
 * Pure and deterministic given `generatedAt`; safe to share because it contains
 * only the already-local findings, optionally run through `redact`.
 */
export function findingsToMarkdown(
  findings: Finding[],
  meta: ReportMeta,
  opts: ReportOptions = {},
): string {
  const label = opts.labelFor ?? ((id: string) => id);
  const redact = opts.redact ?? ((t: string) => t);
  const stamp = (meta.generatedAt ?? new Date())
    .toISOString()
    .slice(0, 16)
    .replace('T', ' ');

  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) counts[f.severity] += 1;

  const lines: string[] = [];
  lines.push(`# Security Report — ${meta.source}`);
  lines.push('');
  lines.push(
    `Generated ${stamp} UTC · LogVibe (local, in-browser) · ${findings.length} finding${findings.length === 1 ? '' : 's'}`,
  );
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Severity | Count |');
  lines.push('| --- | --- |');
  for (const s of SEVERITIES) lines.push(`| ${cap(s)} | ${counts[s]} |`);
  lines.push('');

  if (findings.length === 0) {
    lines.push('_No findings._');
    return lines.join('\n') + '\n';
  }

  lines.push('## Findings');
  lines.push('');

  // Group by rule; Map keeps first-seen order, and we feed it severity-sorted,
  // so groups appear worst-first.
  const groups = new Map<string, Finding[]>();
  for (const f of sortFindings(findings)) {
    const g = groups.get(f.rule);
    if (g) g.push(f);
    else groups.set(f.rule, [f]);
  }

  for (const [ruleId, group] of groups) {
    const technique = group[0].technique;
    lines.push(`### ${label(ruleId)}${technique ? ` — ${technique}` : ''}`);
    lines.push('');
    for (const f of group) {
      lines.push(`- **[${f.severity}]** \`${redact(f.entity)}\` — ${redact(f.detail)}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}
