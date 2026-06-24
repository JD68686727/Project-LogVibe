import type { ColumnFilter, FilterGroup } from '@/types/filter';

let groupCounter = 0;
const nextId = () => `group-legacy-${++groupCounter}`;

export function isColumnFilter(value: unknown): value is ColumnFilter {
  if (typeof value !== 'object' || value === null) return false;
  const f = value as Record<string, unknown>;
  return (
    typeof f.columnKey === 'string' &&
    typeof f.operator === 'string' &&
    typeof f.value === 'string'
  );
}

export function isFilterGroup(value: unknown): value is FilterGroup {
  if (typeof value !== 'object' || value === null) return false;
  const g = value as Record<string, unknown>;
  return (
    typeof g.id === 'string' &&
    Array.isArray(g.filters) &&
    g.filters.every(isColumnFilter)
  );
}

/**
 * Normalizes persisted filter state (shared links, saved views) to the groups
 * model. Validated `groups` win; otherwise legacy flat `filters` wrap into a
 * single group (pre-groups back-compat); otherwise no groups. Ids are
 * placeholders — callers that re-apply (e.g. replaceGroups) reassign them.
 */
export function normalizeFilterGroups(
  groups: unknown,
  legacyFilters?: unknown,
): FilterGroup[] {
  if (Array.isArray(groups)) return groups.filter(isFilterGroup);
  if (Array.isArray(legacyFilters)) {
    const filters = legacyFilters.filter(isColumnFilter);
    return filters.length > 0 ? [{ id: nextId(), filters }] : [];
  }
  return [];
}
