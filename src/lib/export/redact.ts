import type { CellValue } from '@/types/dataset';
import type { TKey } from '@/lib/i18n/translations';
import { PATTERN_LIBRARY } from '@/lib/filter/patternLibrary';

export type RedactionMode = 'consistent' | 'token';

/**
 * Sensitive categories that can be auto-redacted, in replacement precedence
 * order. MAC runs before IPv6 because a MAC (six colon-separated hex pairs)
 * also matches the IPv6 pattern; redacting it first prevents a double hit.
 * (Hostnames / passwords aren't reliably detectable by regex and are out of
 * scope — redact a whole column for those.)
 */
export const REDACTABLE: { id: string; label: TKey; token: string }[] = [
  { id: 'email', label: 'redact.email', token: 'EMAIL' },
  { id: 'mac', label: 'redact.mac', token: 'MAC' },
  { id: 'ipv6', label: 'redact.ipv6', token: 'IP6' },
  { id: 'ipv4', label: 'redact.ipv4', token: 'IP' },
];

function regexFor(id: string): string {
  return PATTERN_LIBRARY.find((p) => p.id === id)?.regex ?? '';
}

/**
 * Builds a cell transformer that replaces matches of the enabled categories.
 * `token` mode replaces every match with a fixed `[TOKEN]`; `consistent` mode
 * maps each distinct value to a stable `[TOKEN_n]`, preserving correlation
 * across the export while anonymizing. Non-string cells pass through unchanged.
 */
export function makeCellRedactor(
  enabledIds: readonly string[],
  mode: RedactionMode,
): (cell: CellValue) => CellValue {
  const rules = REDACTABLE.filter((r) => enabledIds.includes(r.id)).map((r) => ({
    token: r.token,
    re: new RegExp(regexFor(r.id), 'gi'),
  }));

  // Per-token map of distinct value → assigned dummy, for `consistent` mode.
  const assigned = new Map<string, Map<string, string>>();
  const counters = new Map<string, number>();

  const replaceWith = (token: string, match: string): string => {
    if (mode === 'token') return `[${token}]`;
    let m = assigned.get(token);
    if (!m) {
      m = new Map();
      assigned.set(token, m);
    }
    const existing = m.get(match);
    if (existing) return existing;
    const n = (counters.get(token) ?? 0) + 1;
    counters.set(token, n);
    const dummy = `[${token}_${n}]`;
    m.set(match, dummy);
    return dummy;
  };

  return (cell) => {
    if (typeof cell !== 'string' || rules.length === 0) return cell;
    let out = cell;
    for (const rule of rules) {
      out = out.replace(rule.re, (match) => replaceWith(rule.token, match));
    }
    return out;
  };
}
