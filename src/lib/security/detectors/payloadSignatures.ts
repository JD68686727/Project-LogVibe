import type { Dataset } from '@/types/dataset';
import type { Finding } from '@/lib/analysis/findings';
import {
  cellText,
  guessColumn,
  guessColumns,
  IP_NEEDLES,
  PAYLOAD_TARGET_NEEDLES,
} from '../util';

/** High-signal attack payload signatures. Kept deliberately specific to keep
 *  false positives low — these are patterns rarely seen in benign traffic. */
const SIGNATURES: { type: string; label: string; re: RegExp }[] = [
  {
    type: 'sqli',
    label: 'SQL injection',
    re: /\bunion\s+select\b|\bor\s+1\s*=\s*1\b|['"]\s*or\s+['"]?\d+['"]?\s*=\s*['"]?\d+|\b(?:sleep|benchmark)\s*\(|;\s*(?:drop|insert|update|delete)\s+/i,
  },
  {
    type: 'xss',
    label: 'Cross-site scripting',
    re: /<script\b|onerror\s*=|javascript:|<img[^>]+onerror/i,
  },
  {
    type: 'traversal',
    label: 'Path traversal',
    re: /\.\.[/\\]|%2e%2e[/\\%]|\/etc\/passwd\b|\bboot\.ini\b/i,
  },
  {
    type: 'cmdi',
    label: 'Command injection',
    // A shell separator followed by a common command (keeps it high-signal).
    re: /(?:;|\||&&)\s*(?:cat|ls|id|whoami|uname|wget|curl|nc|bash|sh|ping)\b|\$\(\s*(?:cat|ls|id|whoami|uname|wget|curl|nc|bash|sh|ping)\b/i,
  },
  {
    type: 'ssrf',
    label: 'SSRF',
    // Cloud metadata endpoint or an unusual internal-fetch scheme.
    re: /\b169\.254\.169\.254\b|\b(?:file|gopher|dict):\/\//i,
  },
  {
    type: 'log4shell',
    label: 'Log4Shell (JNDI)',
    re: /\$\{jndi:/i,
  },
];

function truncate(s: string, n = 60): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/**
 * Scans request/URL/user-agent fields for injection payloads (SQLi, XSS, path
 * traversal) and reports each (source × payload-type). Unlike the behavioural
 * detectors this is signature-based, so patterns are kept high-signal. No-ops
 * if no plausible target column exists.
 */
export function payloadSignatures(dataset: Dataset, order: number[]): Finding[] {
  const targetCols = guessColumns(dataset, PAYLOAD_TARGET_NEEDLES);
  if (targetCols.length === 0) return [];
  const ipCol = guessColumn(dataset, IP_NEEDLES);

  // key = `${entity}||${type}` → running tally + a representative sample.
  const hits = new Map<
    string,
    { type: string; label: string; entity: string; count: number; sample: string; col: string }
  >();

  for (const r of order) {
    const row = dataset.rows[r];
    const entity = ipCol >= 0 ? cellText(row[ipCol]) || 'unknown' : 'request';

    // First matching signature per type per row (avoids double-counting a row
    // that matches in several columns).
    const matchedThisRow = new Map<string, { label: string; sample: string; col: string }>();
    for (const col of targetCols) {
      const v = cellText(row[col]);
      if (!v) continue;
      for (const sig of SIGNATURES) {
        if (!matchedThisRow.has(sig.type) && sig.re.test(v)) {
          matchedThisRow.set(sig.type, {
            label: sig.label,
            sample: truncate(v),
            col: dataset.columns[col].name,
          });
        }
      }
    }

    for (const [type, info] of matchedThisRow) {
      const key = `${entity}||${type}`;
      const h = hits.get(key);
      if (h) h.count += 1;
      else hits.set(key, { type, label: info.label, entity, count: 1, sample: info.sample, col: info.col });
    }
  }

  const findings: Finding[] = [];
  for (const h of hits.values()) {
    findings.push({
      severity: 'high',
      rule: 'payload-injection',
      entity: h.entity,
      detail: `${h.label} pattern in ${h.col} — ${h.count} request${h.count === 1 ? '' : 's'}, e.g. "${h.sample}"`,
      count: h.count,
      technique: 'T1190 · Exploit Public-Facing Application',
    });
  }
  return findings;
}
