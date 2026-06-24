import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import type { Dataset } from '@/types/dataset';
import type { ColumnFilter, FilterGroup } from '@/types/filter';
import { applyFilterGroups } from '@/lib/filter/applyFilters';
import { applyQuickSearch } from '@/lib/filter/quickSearch';
import { operatorsForType } from '@/lib/filter/operators';

let filterCounter = 0;
const nextFilterId = () => `filter-${++filterCounter}`;
let groupCounter = 0;
const nextGroupId = () => `group-${++groupCounter}`;

function defaultFilter(dataset: Dataset): ColumnFilter {
  const col = dataset.columns[0];
  const op = col ? (operatorsForType(col.type)[0]?.value ?? 'isNotEmpty') : 'isNotEmpty';
  return { id: nextFilterId(), columnKey: col?.key ?? '', operator: op, value: '' };
}

export interface UseFilters {
  /** Condition groups: filters within a group AND, groups OR. */
  groups: FilterGroup[];
  /** Appends a new OR group seeded with one default condition. */
  addGroup: () => void;
  /** Appends a default AND condition to a group. */
  addCondition: (groupId: string) => void;
  updateFilter: (
    groupId: string,
    filterId: string,
    patch: Partial<ColumnFilter>,
  ) => void;
  /** Removes a condition; prunes the group if it becomes empty. */
  removeFilter: (groupId: string, filterId: string) => void;
  removeGroup: (groupId: string) => void;
  clearFilters: () => void;
  /** Replaces all groups (applying a saved preset / shared link), fresh ids. */
  replaceGroups: (groups: FilterGroup[]) => void;
  /** Appends a fully-specified condition to the first group (drill-downs). */
  addColumnFilter: (filter: Omit<ColumnFilter, 'id'>) => void;
  /** Free-text "search across all columns" query (immediate, for the input). */
  query: string;
  setQuery: (query: string) => void;
  /** Row indices passing the filter groups AND the search. Memoized. */
  filteredOrder: number[];
}

export function useFilters(dataset: Dataset | null): UseFilters {
  const [groups, setGroups] = useState<FilterGroup[]>([]);
  const [query, setQuery] = useState('');
  // Keep typing responsive on large files: the heavy re-filter uses a deferred
  // copy of the query so React can prioritise the input over recomputation.
  const deferredQuery = useDeferredValue(query);

  const addGroup = useCallback(() => {
    if (!dataset || dataset.columns.length === 0) return;
    setGroups((prev) => [
      ...prev,
      { id: nextGroupId(), filters: [defaultFilter(dataset)] },
    ]);
  }, [dataset]);

  const addCondition = useCallback(
    (groupId: string) => {
      if (!dataset || dataset.columns.length === 0) return;
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, filters: [...g.filters, defaultFilter(dataset)] }
            : g,
        ),
      );
    },
    [dataset],
  );

  const updateFilter = useCallback(
    (groupId: string, filterId: string, patch: Partial<ColumnFilter>) => {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                filters: g.filters.map((f) =>
                  f.id === filterId ? { ...f, ...patch } : f,
                ),
              }
            : g,
        ),
      );
    },
    [],
  );

  const removeFilter = useCallback((groupId: string, filterId: string) => {
    setGroups((prev) =>
      prev
        .map((g) =>
          g.id === groupId
            ? { ...g, filters: g.filters.filter((f) => f.id !== filterId) }
            : g,
        )
        .filter((g) => g.filters.length > 0),
    );
  }, []);

  const removeGroup = useCallback((groupId: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  }, []);

  const clearFilters = useCallback(() => setGroups([]), []);

  const replaceGroups = useCallback((next: FilterGroup[]) => {
    // Reassign ids so restored groups/filters can't collide with live keys.
    setGroups(
      next.map((g) => ({
        id: nextGroupId(),
        filters: g.filters.map((f) => ({ ...f, id: nextFilterId() })),
      })),
    );
  }, []);

  const addColumnFilter = useCallback((filter: Omit<ColumnFilter, 'id'>) => {
    const withId: ColumnFilter = { ...filter, id: nextFilterId() };
    // Drill-downs narrow the view → AND into the first group (create if none).
    setGroups((prev) => {
      if (prev.length === 0) return [{ id: nextGroupId(), filters: [withId] }];
      return prev.map((g, i) =>
        i === 0 ? { ...g, filters: [...g.filters, withId] } : g,
      );
    });
  }, []);

  const filteredOrder = useMemo(() => {
    if (!dataset) return [];
    // Structured groups first (cheap predicates), then the cross-column search
    // on the survivors only.
    const structured = applyFilterGroups(dataset, groups);
    return applyQuickSearch(dataset, structured, deferredQuery);
  }, [dataset, groups, deferredQuery]);

  return {
    groups,
    addGroup,
    addCondition,
    updateFilter,
    removeFilter,
    removeGroup,
    clearFilters,
    replaceGroups,
    addColumnFilter,
    query,
    setQuery,
    filteredOrder,
  };
}
