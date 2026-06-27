import type { LogParseResult, LogPattern } from '@/types/logPattern';

/** Hard row cap mirroring the CSV path — protects the browser's memory. */
const MAX_ROWS = 500_000;

/** Matches `(?<name>` to pull out named-group names in source order. */
const NAMED_GROUP_RE = /\(\?<([A-Za-z_]\w*)>/g;

export type CompileResult =
  | { ok: true; re: RegExp; fields: string[] }
  | { ok: false; error: string };

/** Per-line exec wants a single, stateless match — drop g/y, keep i/m/s/u. */
function sanitizeFlags(flags: string): string {
  return [...new Set(flags)].filter((f) => 'imsu'.includes(f)).join('');
}

/**
 * Compiles a log pattern into a RegExp plus its ordered, unique named-group
 * names (the future columns). Returns a typed error for an invalid pattern or
 * one with no named groups, so the UI can show it inline instead of throwing.
 */
export function compilePattern(pattern: LogPattern): CompileResult {
  const fields: string[] = [];
  const seen = new Set<string>();
  for (const m of pattern.regex.matchAll(NAMED_GROUP_RE)) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      fields.push(name);
    }
  }
  if (fields.length === 0) {
    return {
      ok: false,
      error: 'Add at least one named group, e.g. (?<message>.*)',
    };
  }

  let re: RegExp;
  try {
    re = new RegExp(pattern.regex, sanitizeFlags(pattern.flags));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid pattern' };
  }
  return { ok: true, re, fields };
}

/** Parses one line; returns the field values in order, or null if it didn't match. */
export function parseLine(
  re: RegExp,
  fields: string[],
  line: string,
): string[] | null {
  const m = re.exec(line);
  if (!m) return null;
  return fields.map((f) => m.groups?.[f] ?? '');
}

/**
 * Parses log text line-by-line with a pattern into headers + string rows — the
 * same `(headers, string[][])` shape the CSV path feeds into `assembleDataset`.
 * Blank lines are skipped; non-matching lines are counted (`unmatched`); parsing
 * stops at `maxRows`. An invalid pattern yields an empty result (the caller
 * shows the compile error separately).
 */
export function parseLogText(
  text: string,
  pattern: LogPattern,
  opts: { maxRows?: number } = {},
): LogParseResult {
  const compiled = compilePattern(pattern);
  if (!compiled.ok) {
    return { headers: [], rows: [], matched: 0, unmatched: 0, truncated: false };
  }
  const { re, fields } = compiled;
  const maxRows = opts.maxRows ?? MAX_ROWS;

  const rows: string[][] = [];
  let unmatched = 0;
  let truncated = false;

  for (const line of text.split(/\r?\n/)) {
    if (line.length === 0) continue; // skip blank lines
    if (rows.length >= maxRows) {
      truncated = true;
      break;
    }
    const parsed = parseLine(re, fields, line);
    if (parsed) rows.push(parsed);
    else unmatched += 1;
  }

  return { headers: fields, rows, matched: rows.length, unmatched, truncated };
}
