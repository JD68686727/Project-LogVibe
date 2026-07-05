export interface SplitResult {
  /** Complete (non-blank) lines ready to parse. */
  lines: string[];
  /** A trailing partial line held back until more bytes arrive. */
  remainder: string;
}

/**
 * Splits appended log text into complete lines, buffering a trailing partial
 * line across reads. `prevRemainder` is the leftover from the previous chunk;
 * the returned `remainder` is the new leftover. Blank lines are dropped. Used
 * by both the initial tail parse and each incremental read, so a line split
 * across two `File.slice` reads is never lost or double-counted.
 */
export function splitAppended(prevRemainder: string, chunk: string): SplitResult {
  const parts = (prevRemainder + chunk).split(/\r?\n/);
  const remainder = parts.pop() ?? '';
  const lines = parts.filter((l) => l.trim().length > 0);
  return { lines, remainder };
}
