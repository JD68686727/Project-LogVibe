import type {
  CellValue,
  ColumnSchema,
  ColumnType,
  Dataset,
} from '@/types/dataset';
import type { ColumnFilter, FilterGroup } from '@/types/filter';
import { getOperator } from './operators';

/** Converts a cell to a comparable number for ordered/date operators. */
function numericValue(cell: CellValue, type: ColumnType): number | null {
  if (cell == null) return null;
  if (type === 'date') {
    const t = Date.parse(String(cell));
    return Number.isNaN(t) ? null : t;
  }
  const n = typeof cell === 'number' ? cell : Number(cell);
  return Number.isNaN(n) ? null : n;
}

/** Parses a raw operand string the same way, so cell & operand are comparable. */
function numericOperand(raw: string, type: ColumnType): number | null {
  if (raw.trim() === '') return null;
  if (type === 'date') {
    const t = Date.parse(raw);
    return Number.isNaN(t) ? null : t;
  }
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

/** True when a filter has all the operands its operator requires. */
export function isFilterComplete(filter: ColumnFilter): boolean {
  const meta = getOperator(filter.operator);
  if (!meta) return false;
  if (meta.arity === 0) return true;
  if (meta.arity === 2) {
    return filter.value.trim() !== '' && (filter.value2 ?? '').trim() !== '';
  }
  return filter.value.trim() !== '';
}

type Predicate = (cell: CellValue) => boolean;

interface CompiledFilter {
  colIdx: number;
  predicate: Predicate;
}

/** Compiles complete filters to (column, predicate) pairs; unknown columns dropped. */
function compileFilters(dataset: Dataset, filters: ColumnFilter[]): CompiledFilter[] {
  return filters
    .filter(isFilterComplete)
    .map((f) => {
      const colIdx = dataset.columnIndex[f.columnKey];
      if (colIdx == null) return null;
      return { colIdx, predicate: buildPredicate(f, dataset.columns[colIdx]) };
    })
    .filter((x): x is CompiledFilter => x !== null);
}

/** Compiles a single filter into a fast predicate (operands parsed once). */
function buildPredicate(filter: ColumnFilter, column: ColumnSchema): Predicate {
  const { operator } = filter;
  const type = column.type;

  switch (operator) {
    case 'isEmpty':
      return (c) => c == null || c === '';
    case 'isNotEmpty':
      return (c) => c != null && c !== '';
    case 'isTrue':
      return (c) => c === true;
    case 'isFalse':
      return (c) => c === false;

    case 'contains': {
      const needle = filter.value.toLowerCase();
      return (c) => c != null && String(c).toLowerCase().includes(needle);
    }
    case 'notContains': {
      const needle = filter.value.toLowerCase();
      return (c) => c == null || !String(c).toLowerCase().includes(needle);
    }

    case 'equals':
    case 'notEquals': {
      const negate = operator === 'notEquals';
      if (type === 'number') {
        const n = Number(filter.value);
        return (c) => {
          const match = typeof c === 'number' && c === n;
          return negate ? !match : match;
        };
      }
      const v = filter.value.toLowerCase();
      return (c) => {
        const match = c != null && String(c).toLowerCase() === v;
        return negate ? !match : match;
      };
    }

    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const bound = numericOperand(filter.value, type);
      if (bound == null) return () => true; // invalid operand → no-op
      return (c) => {
        const n = numericValue(c, type);
        if (n == null) return false;
        if (operator === 'gt') return n > bound;
        if (operator === 'gte') return n >= bound;
        if (operator === 'lt') return n < bound;
        return n <= bound;
      };
    }

    case 'between': {
      const lo = numericOperand(filter.value, type);
      const hi = numericOperand(filter.value2 ?? '', type);
      if (lo == null || hi == null) return () => true;
      const min = Math.min(lo, hi);
      const max = Math.max(lo, hi);
      return (c) => {
        const n = numericValue(c, type);
        return n != null && n >= min && n <= max;
      };
    }

    default:
      return () => true;
  }
}

/**
 * Returns the indices of rows matching ALL complete filters (AND semantics).
 * Operating on an index array — optionally a pre-filtered `baseOrder` — means we
 * never copy row data; filtering composes cleanly with sorting downstream.
 */
export function applyFilters(
  dataset: Dataset,
  filters: ColumnFilter[],
  baseOrder?: number[],
): number[] {
  const base = baseOrder ?? dataset.rows.map((_, i) => i);
  const compiled = compileFilters(dataset, filters);
  if (compiled.length === 0) return base;

  const { rows } = dataset;
  return base.filter((rowIdx) => {
    const row = rows[rowIdx];
    return compiled.every(({ colIdx, predicate }) => predicate(row[colIdx]));
  });
}

/**
 * Returns the indices of rows matching ANY group (OR), where a group matches
 * when ALL its complete filters pass (AND) — i.e. `(A AND B) OR (C)`. Groups
 * with no complete filters are ignored; if no group has any, `base` passes
 * through unfiltered. A single group reproduces `applyFilters`.
 */
export function applyFilterGroups(
  dataset: Dataset,
  groups: FilterGroup[],
  baseOrder?: number[],
): number[] {
  const base = baseOrder ?? dataset.rows.map((_, i) => i);
  const compiledGroups = groups
    .map((g) => compileFilters(dataset, g.filters))
    .filter((g) => g.length > 0);

  if (compiledGroups.length === 0) return base;

  const { rows } = dataset;
  return base.filter((rowIdx) => {
    const row = rows[rowIdx];
    return compiledGroups.some((group) =>
      group.every(({ colIdx, predicate }) => predicate(row[colIdx])),
    );
  });
}
