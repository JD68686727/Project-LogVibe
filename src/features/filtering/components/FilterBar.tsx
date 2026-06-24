import type { Dataset } from '@/types/dataset';
import type { ColumnFilter, FilterGroup } from '@/types/filter';
import { FilterRow } from './FilterRow';

export interface FilterBarProps {
  dataset: Dataset;
  groups: FilterGroup[];
  onAddGroup: () => void;
  onAddCondition: (groupId: string) => void;
  onUpdate: (groupId: string, filterId: string, patch: Partial<ColumnFilter>) => void;
  onRemoveFilter: (groupId: string, filterId: string) => void;
  onRemoveGroup: (groupId: string) => void;
  onClear: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  resultCount: number;
  totalCount: number;
}

const addBtn =
  'rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700';
const linkBtn =
  'text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300';

export function FilterBar({
  dataset,
  groups,
  onAddGroup,
  onAddCondition,
  onUpdate,
  onRemoveFilter,
  onRemoveGroup,
  onClear,
  query,
  onQueryChange,
  resultCount,
  totalCount,
}: FilterBarProps) {
  const isFiltered = resultCount !== totalCount;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
      {/* Global search — grep across all columns */}
      <div className="relative mb-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search all columns…"
          aria-label="Search all columns"
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500"
        />
        {query !== '' && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            Filters
          </span>
          <span
            className={
              isFiltered
                ? 'rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-300'
                : 'text-xs text-slate-400 dark:text-slate-500'
            }
          >
            {resultCount.toLocaleString()} of {totalCount.toLocaleString()} rows
          </span>
        </div>

        <div className="flex items-center gap-2">
          {groups.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              Clear all
            </button>
          )}
          <button type="button" onClick={onAddGroup} className={addBtn}>
            + Add filter
          </button>
        </div>
      </div>

      {groups.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {groups.map((group, gi) => (
            <div key={group.id}>
              {gi > 0 && (
                <div className="my-1 flex items-center gap-2" aria-hidden>
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                    or
                  </span>
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                </div>
              )}
              <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex flex-col gap-1.5">
                  {group.filters.map((filter, fi) => (
                    <div key={filter.id}>
                      {fi > 0 && (
                        <div className="px-1 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          and
                        </div>
                      )}
                      <FilterRow
                        dataset={dataset}
                        filter={filter}
                        onChange={(patch) => onUpdate(group.id, filter.id, patch)}
                        onRemove={() => onRemoveFilter(group.id, filter.id)}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between px-1">
                  <button
                    type="button"
                    onClick={() => onAddCondition(group.id)}
                    className={linkBtn}
                  >
                    + AND condition
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveGroup(group.id)}
                    aria-label="Remove group"
                    className="text-xs font-medium text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400"
                  >
                    Remove group
                  </button>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={onAddGroup}
            className="self-start rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-500 hover:border-brand-400 hover:text-brand-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-brand-500 dark:hover:text-brand-300"
          >
            + OR group
          </button>
        </div>
      )}
    </div>
  );
}
