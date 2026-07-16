/**
 * Safe compilation of *user-supplied* regexes. The app runs free-text and
 * derived-column regexes over every cell on the main thread, so a hostile or
 * accidental catastrophic-backtracking pattern (e.g. from a share link) could
 * freeze the tab. This module compiles defensively: invalid, or likely
 * catastrophic, patterns yield `null` (callers treat that as "no regex").
 */

/** Keeps only safe, order-independent flags. Drops `g`/`y` (which change
 *  `String.match` to return all matches with no capture groups) and invalid
 *  chars. */
export function sanitizeFlags(flags: string | undefined): string {
  return [...new Set(flags ?? '')].filter((f) => 'imsu'.includes(f)).join('');
}

/** Length of an unbounded quantifier (`*`, `+`, `{n,}`) at `pos`, else 0.
 *  Bounded quantifiers (`?`, `{n}`, `{n,m}`) return 0 — they can't blow up. */
function unboundedQuantLen(src: string, pos: number): number {
  const c = src[pos];
  if (c === '*' || c === '+') {
    return src[pos + 1] === '?' ? 2 : 1; // include a lazy `?`
  }
  if (c === '{') {
    const m = /^\{\d*,\}/.exec(src.slice(pos)); // {n,} with no upper bound
    if (m) return m[0].length + (src[pos + m[0].length] === '?' ? 1 : 0);
  }
  return 0;
}

/**
 * Conservatively flags the classic catastrophic-backtracking shape: an
 * unbounded quantifier applied to a group that itself contains an unbounded
 * quantifier (star height ≥ 2) — `(a+)+`, `(\d+)*`, `([a-z]*)+`, nested. It
 * won't catch every ReDoS (e.g. overlapping alternation `(a|a)*`), but it
 * neutralizes the dominant, easy-to-trigger family without a dependency.
 */
export function isLikelyCatastrophic(src: string): boolean {
  const innerUnbounded: boolean[] = []; // per open group: seen an unbounded quantifier?
  let i = 0;
  let inClass = false;

  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      i += 2; // skip an escaped char
      continue;
    }
    if (inClass) {
      if (c === ']') inClass = false;
      i += 1;
      continue;
    }
    if (c === '[') {
      inClass = true;
      i += 1;
      continue;
    }
    if (c === '(') {
      innerUnbounded.push(false);
      i += 1;
      continue;
    }
    if (c === ')') {
      const hadInner = innerUnbounded.pop() ?? false;
      const qLen = unboundedQuantLen(src, i + 1);
      if (qLen > 0) {
        if (hadInner) return true; // quantified group containing a quantifier
        // A quantified group is itself an unbounded quantifier at the parent.
        if (innerUnbounded.length) innerUnbounded[innerUnbounded.length - 1] = true;
      }
      i += 1 + qLen;
      continue;
    }
    const qLen = unboundedQuantLen(src, i);
    if (qLen > 0) {
      if (innerUnbounded.length) innerUnbounded[innerUnbounded.length - 1] = true;
      i += qLen;
      continue;
    }
    i += 1;
  }
  return false;
}

/**
 * Compiles a user regex, returning `null` instead of throwing on an invalid
 * pattern/flags — or when the pattern is likely catastrophic. Callers treat
 * `null` as "don't run a regex" (a no-op filter / skipped derived column).
 */
export function safeRegExp(pattern: string, flags?: string): RegExp | null {
  if (isLikelyCatastrophic(pattern)) return null;
  try {
    return new RegExp(pattern, sanitizeFlags(flags));
  } catch {
    return null;
  }
}
