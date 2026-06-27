/** A user-defined log format: a RegExp whose named groups become columns. */
export interface LogPattern {
  /** RegExp source; each `(?<name>…)` named group maps to a column. */
  regex: string;
  /** RegExp flags (only i/m/s/u are honoured; g/y are stripped). */
  flags: string;
}

/** A persisted, named log pattern (LocalStorage), e.g. "Nginx Access Log". */
export interface SavedLogPattern extends LogPattern {
  id: string;
  name: string;
  createdAt: number;
}

/** Result of parsing log text with a pattern — same shape the CSV path produces. */
export interface LogParseResult {
  /** Column names, in named-group order. */
  headers: string[];
  /** Parsed rows (one string per field), aligned to `headers`. */
  rows: string[][];
  matched: number;
  /** Non-blank lines that didn't match the pattern. */
  unmatched: number;
  /** True when the row cap was hit and parsing stopped early. */
  truncated: boolean;
}
