import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { ColumnType, Dataset } from '@/types/dataset';
import type { DerivedSpec } from '@/lib/table/deriveColumn';
import type { SavedView } from '@/types/view';
import type { ViewState } from '@/types/share';
import { useFilters } from '@/features/filtering/hooks/useFilters';
import { FilterBar } from '@/features/filtering/components/FilterBar';
import { ExtractPanel } from '@/features/filtering/components/ExtractPanel';
import { normalizeFilterGroups } from '@/lib/filter/normalizeGroups';
import type { QuickPattern } from '@/lib/filter/patternLibrary';
import { signatureFor } from '@/lib/storage/viewStore';
import { getLastView, setLastView } from '@/lib/storage/lastViewStore';
import { useSortedRows } from '@/features/table/hooks/useSortedRows';
import { DataTable } from '@/features/table/components/DataTable';
import { RowDetail } from '@/features/table/components/RowDetail';
import { useColumnView } from '@/features/table/hooks/useColumnView';
import { ColumnManager } from '@/features/table/components/ColumnManager';
import { ExportMenu } from '@/features/export/components/ExportMenu';
import { ShareButton } from '@/features/sharing/components/ShareButton';
import { SecurityScanButton } from '@/features/security/components/SecurityScanButton';
import { StatsPanel } from '@/features/stats/components/StatsPanel';
import { PivotPanel } from '@/features/pivot/components/PivotPanel';
import { usePivotConfig } from '@/features/pivot/hooks/usePivotConfig';
import { useChartConfig } from '@/features/visualization/hooks/useChartConfig';
import { DEFAULT_TZ } from '@/lib/time/timezone';
import { usePresets } from '@/features/presets/hooks/usePresets';
import { PresetBar } from '@/features/presets/components/PresetBar';
import { ChartSkeleton } from '@/components/ChartSkeleton';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Recharts is heavy (~d3 deps); load the chart panel only once a file is open
// so the initial drop-zone bundle stays lean. `useChartConfig` itself pulls no
// Recharts code, so owning the chart state here keeps it out of the main chunk.
const ChartPanel = lazy(() =>
  import('@/features/visualization/components/ChartPanel').then((m) => ({
    default: m.ChartPanel,
  })),
);

export interface DataWorkspaceProps {
  dataset: Dataset;
  /** A view from a shared link, applied once after this mounts. */
  pending: ViewState | null;
  onConsumePending: () => void;
  /** Override a column's inferred type on the active file. */
  onRetypeColumn: (columnKey: string, type: ColumnType) => void;
  /** Add a computed (regex-extract) column to the active file. */
  onAddDerivedColumn?: (spec: DerivedSpec) => void;
  /** Remove a (derived) column from the active file. */
  onRemoveColumn?: (columnKey: string) => void;
  /** Opens a derived dataset (e.g. a security scan's findings) as a new file. */
  onOpenDataset?: (dataset: Dataset) => void;
  /** Display timezone for date columns + chart buckets (default UTC). */
  timeZone?: string;
  /** Pin the table to the newest rows (live tailing of this file). */
  autoScroll?: boolean;
}

/**
 * Orchestrates the data view. Filtering feeds its surviving row indices into
 * sorting (drives the table) and into the chart aggregation. Filter + chart
 * state live here so presets can snapshot and restore both at once. Every stage
 * works on index arrays, so a 50k-row dataset is never copied. Mounted with a
 * `key` tied to the dataset in App, so a new file gets fresh state for free.
 */
export function DataWorkspace({
  dataset,
  pending,
  onConsumePending,
  onRetypeColumn,
  onAddDerivedColumn,
  onRemoveColumn,
  onOpenDataset,
  timeZone = DEFAULT_TZ,
  autoScroll,
}: DataWorkspaceProps) {
  const filtersApi = useFilters(dataset);
  const chart = useChartConfig(dataset, filtersApi.filteredOrder, timeZone);
  const columnView = useColumnView(dataset);
  const pivot = usePivotConfig(dataset);
  const presets = usePresets(dataset);
  const [selectedRowIdx, setSelectedRowIdx] = useState<number | null>(null);
  const { order, sortKeys, toggleSort, setSort } = useSortedRows(
    dataset,
    filtersApi.filteredOrder,
  );

  const { replaceGroups, groups, filteredOrder, query, setQuery } = filtersApi;
  const { searchRegex, setSearchRegex } = filtersApi;
  const { applyConfig, config: chartConfig } = chart;
  const { applyView, view: columnViewState, visible: visibleColumns } = columnView;
  const { applyConfig: applyPivot, config: pivotConfig } = pivot;

  const [extractPattern, setExtractPattern] = useState<QuickPattern | null>(null);

  // The shareable view, built only when the Share button is clicked.
  const getView = useCallback(
    (): ViewState => ({
      groups,
      query,
      searchRegex,
      sort: sortKeys,
      chart: chartConfig,
      columns: columnViewState,
      pivot: pivotConfig,
    }),
    [groups, query, searchRegex, sortKeys, chartConfig, columnViewState, pivotConfig],
  );

  // Applies a full view (shared link / saved auto-view) through every stage.
  const applyViewState = useCallback(
    (view: ViewState) => {
      replaceGroups(view.groups);
      setQuery(view.query);
      setSearchRegex(view.searchRegex ?? false);
      setSort(view.sort);
      applyConfig(view.chart);
      applyView(view.columns);
      if (view.pivot) applyPivot(view.pivot);
    },
    [replaceGroups, setQuery, setSearchRegex, setSort, applyConfig, applyView, applyPivot],
  );

  // Apply a view from a shared link once, now that the dataset exists.
  useEffect(() => {
    if (!pending) return;
    applyViewState(pending);
    onConsumePending();
  }, [pending, applyViewState, onConsumePending]);

  // --- "Pick up where you left off" -----------------------------------------
  // Remember the last shaped view per schema signature (config only, never row
  // data), and offer to restore it when a file with that structure loads again.
  const signature = useMemo(() => signatureFor(dataset), [dataset]);
  const [offered] = useState<ViewState | null>(() => getLastView(signature));
  const [restoreDismissed, setRestoreDismissed] = useState(false);
  const showRestore = !!offered && !pending && !restoreDismissed;
  const offeredFilterCount =
    offered?.groups.reduce((n, g) => n + g.filters.length, 0) ?? 0;

  useEffect(() => {
    const view = getView();
    // Only remember a view the user actually shaped (filters / search / sort).
    if (view.groups.length === 0 && view.query === '' && view.sort.length === 0) {
      return;
    }
    const t = setTimeout(() => {
      setLastView(signature, view);
      setRestoreDismissed(true); // once they're working, drop the restore offer
    }, 600);
    return () => clearTimeout(t);
  }, [getView, signature]);

  const handleApply = useCallback(
    (view: SavedView) => {
      replaceGroups(normalizeFilterGroups(view.groups, view.filters));
      applyConfig(view.chart);
      if (view.columns) applyView(view.columns);
      if (view.pivot) applyPivot(view.pivot);
    },
    [replaceGroups, applyConfig, applyView, applyPivot],
  );

  const handleSave = useCallback(
    (name: string) =>
      presets.savePreset(name, groups, chartConfig, columnViewState, pivotConfig),
    [presets, groups, chartConfig, columnViewState, pivotConfig],
  );

  return (
    <div className="space-y-3">
      {showRestore && offered && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm dark:border-brand-500/30 dark:bg-brand-500/10">
          <span className="text-slate-700 dark:text-slate-200">
            Welcome back — restore your last view for this file structure?{' '}
            <span className="text-slate-400 dark:text-slate-500">
              ({offeredFilterCount} filter{offeredFilterCount === 1 ? '' : 's'}
              {offered.sort.length > 0 ? ' · sorted' : ''}
              {offered.query ? ' · search' : ''})
            </span>
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setRestoreDismissed(true)}
              className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-200/60 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={() => {
                applyViewState(offered);
                setRestoreDismissed(true);
              }}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Restore last view
            </button>
          </div>
        </div>
      )}

      <PresetBar
        views={presets.views}
        onApply={handleApply}
        onSave={handleSave}
        onDelete={presets.deletePreset}
      />

      <FilterBar
        dataset={dataset}
        groups={groups}
        onAddGroup={filtersApi.addGroup}
        onAddCondition={filtersApi.addCondition}
        onUpdate={filtersApi.updateFilter}
        onRemoveFilter={filtersApi.removeFilter}
        onRemoveGroup={filtersApi.removeGroup}
        onClear={filtersApi.clearFilters}
        query={query}
        onQueryChange={filtersApi.setQuery}
        searchRegex={searchRegex}
        onToggleRegex={() => setSearchRegex(!searchRegex)}
        onQuickPattern={filtersApi.applyQuickPattern}
        onExtract={setExtractPattern}
        resultCount={filteredOrder.length}
        totalCount={dataset.rows.length}
      />

      {extractPattern && (
        <ExtractPanel
          dataset={dataset}
          order={filteredOrder}
          pattern={extractPattern}
          onPickValue={(value) => {
            setSearchRegex(false);
            setQuery(value);
            setExtractPattern(null);
          }}
          onClose={() => setExtractPattern(null)}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ColumnManager
          items={columnView.items}
          onToggle={columnView.toggle}
          onMove={columnView.move}
          onShowAll={columnView.showAll}
          onReset={columnView.reset}
          onRetype={onRetypeColumn}
          onAddDerived={onAddDerivedColumn}
          onRemove={onRemoveColumn}
        />
        <div className="flex items-center gap-2">
          {onOpenDataset && (
            <SecurityScanButton
              dataset={dataset}
              order={filteredOrder}
              onOpenDataset={onOpenDataset}
            />
          )}
          <ShareButton getView={getView} />
          <ExportMenu
            dataset={dataset}
            order={order}
            columns={visibleColumns}
            timeZone={timeZone}
          />
        </div>
      </div>

      <StatsPanel
        dataset={dataset}
        order={filteredOrder}
        onAddFilter={filtersApi.addColumnFilter}
        timeZone={timeZone}
      />

      <DataTable
        dataset={dataset}
        columns={visibleColumns}
        order={order}
        sortKeys={sortKeys}
        onToggleSort={toggleSort}
        onSelectRow={setSelectedRowIdx}
        selectedRowIdx={selectedRowIdx}
        timeZone={timeZone}
        autoScroll={autoScroll}
      />

      {selectedRowIdx !== null && (
        <RowDetail
          dataset={dataset}
          order={order}
          rowIdx={selectedRowIdx}
          onNavigate={setSelectedRowIdx}
          onClose={() => setSelectedRowIdx(null)}
          onAddFilter={filtersApi.addColumnFilter}
          timeZone={timeZone}
        />
      )}

      <ErrorBoundary
        fallback={(_error, reset) => (
          <div
            role="alert"
            className="flex h-80 flex-col items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-center dark:border-rose-500/30 dark:bg-rose-500/10"
          >
            <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
              Chart failed to render
            </p>
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-rose-300 bg-white px-3 py-1 text-sm font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-slate-800 dark:text-rose-300 dark:hover:bg-rose-500/20"
            >
              Try again
            </button>
          </div>
        )}
      >
        <Suspense fallback={<ChartSkeleton className="h-80" />}>
          <ChartPanel dataset={dataset} chart={chart} />
        </Suspense>
      </ErrorBoundary>

      <PivotPanel
        dataset={dataset}
        order={filteredOrder}
        pivot={pivot}
        onAddFilter={filtersApi.addColumnFilter}
      />
    </div>
  );
}
