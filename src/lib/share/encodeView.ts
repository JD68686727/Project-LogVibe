import type { ViewState } from '@/types/share';
import type { PivotConfig } from '@/types/pivot';
import type { SortKey } from '@/types/table';
import type { DerivedSpec } from '@/lib/table/deriveColumn';
import { normalizeFilterGroups } from '@/lib/filter/normalizeGroups';

/** URL-safe base64 of a UTF-8 string (browser-native, no deps). */
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Serializes a view to a compact, URL-safe token. */
export function encodeView(view: ViewState): string {
  return toBase64Url(JSON.stringify(view));
}

function isSortKey(value: unknown): value is SortKey {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.columnKey === 'string' &&
    (s.direction === 'asc' || s.direction === 'desc')
  );
}

/** Normalises `sort` to the array model, accepting legacy single-sort links. */
function normalizeSort(raw: unknown): SortKey[] {
  if (Array.isArray(raw)) return raw.filter(isSortKey);
  if (isSortKey(raw)) return [raw]; // legacy { columnKey, direction }
  return [];
}

function isPivotConfig(value: unknown): value is PivotConfig {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    (p.rowKey === null || typeof p.rowKey === 'string') &&
    (p.colKey === null || typeof p.colKey === 'string') &&
    (p.aggregation === 'count' || p.aggregation === 'sum' || p.aggregation === 'avg') &&
    (p.measureKey === null || typeof p.measureKey === 'string')
  );
}

const COLUMN_TYPES = new Set(['string', 'number', 'boolean', 'date']);

/** Validates one computed-column recipe from an untrusted link. */
function isDerivedSpec(value: unknown): value is DerivedSpec {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  if (typeof s.name !== 'string') return false;
  if (s.type !== undefined && !COLUMN_TYPES.has(s.type as string)) return false;
  if (s.kind === 'arithmetic') {
    return (
      typeof s.left === 'string' &&
      typeof s.right === 'string' &&
      (s.op === '+' || s.op === '-' || s.op === '*' || s.op === '/')
    );
  }
  if (s.kind === 'concat') return typeof s.template === 'string';
  // extract (kind undefined or 'extract')
  return typeof s.sourceKey === 'string' && typeof s.pattern === 'string';
}

/** Keeps only well-formed derived specs; undefined when absent/empty. */
function normalizeDerived(raw: unknown): DerivedSpec[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const specs = raw.filter(isDerivedSpec);
  return specs.length > 0 ? specs : undefined;
}

/** Validates the shared fields; `sort`/`groups` are normalised separately. */
function isViewBase(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    // Accept the groups model and legacy flat `filters` links.
    (Array.isArray(v.groups) || Array.isArray(v.filters)) &&
    typeof v.query === 'string' &&
    typeof v.chart === 'object' &&
    v.chart !== null &&
    Array.isArray(v.columns)
  );
}

/** Parses a token back to a ViewState, or null if it's malformed. */
export function decodeView(token: string): ViewState | null {
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(token));
    if (!isViewBase(parsed)) return null;
    const raw = parsed as Record<string, unknown>;
    return {
      groups: normalizeFilterGroups(raw.groups, raw.filters),
      query: raw.query as string,
      searchRegex: raw.searchRegex === true ? true : undefined,
      sort: normalizeSort(raw.sort),
      chart: raw.chart as ViewState['chart'],
      columns: raw.columns as ViewState['columns'],
      pivot: isPivotConfig(raw.pivot) ? raw.pivot : undefined,
      derived: normalizeDerived(raw.derived),
    };
  } catch {
    return null;
  }
}
