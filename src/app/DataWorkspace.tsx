import { lazy, Suspense, useCallback, useEffect } from 'react';
import type { Dataset } from '@/types/dataset';
import type { SavedView } from '@/types/view';
import type { ViewState } from '@/types/share';
import { useFilters } from '@/features/filtering/hooks/useFilters';
import { FilterBar } from '@/features/filtering/components/FilterBar';
import { useSortedRows } from '@/features/table/hooks/useSortedRows';
import { DataTable } from '@/features/table/components/DataTable';
import { useColumnView } from '@/features/table/hooks/useColumnView';
import { ColumnManager } from '@/features/table/components/ColumnManager';
import { ExportButton } from '@/features/export/components/ExportButton';
import { ShareButton } from '@/features/sharing/components/ShareButton';
import { StatsPanel } from '@/features/stats/components/StatsPanel';
import { useChartConfig } from '@/features/visualization/hooks/useChartConfig';
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
}: DataWorkspaceProps) {
  const filtersApi = useFilters(dataset);
  const chart = useChartConfig(dataset, filtersApi.filteredOrder);
  const columnView = useColumnView(dataset);
  const presets = usePresets(dataset);
  const { order, sort, toggleSort, setSort } = useSortedRows(
    dataset,
    filtersApi.filteredOrder,
  );

  const { replaceFilters, filters, filteredOrder, query, setQuery } = filtersApi;
  const { applyConfig, config: chartConfig } = chart;
  const { applyView, view: columnViewState, visible: visibleColumns } = columnView;

  // The shareable view, built only when the Share button is clicked.
  const getView = useCallback(
    (): ViewState => ({
      filters,
      query,
      sort,
      chart: chartConfig,
      columns: columnViewState,
    }),
    [filters, query, sort, chartConfig, columnViewState],
  );

  // Apply a view from a shared link once, now that the dataset exists.
  useEffect(() => {
    if (!pending) return;
    replaceFilters(pending.filters);
    setQuery(pending.query);
    setSort(pending.sort);
    applyConfig(pending.chart);
    applyView(pending.columns);
    onConsumePending();
  }, [
    pending,
    replaceFilters,
    setQuery,
    setSort,
    applyConfig,
    applyView,
    onConsumePending,
  ]);

  const handleApply = useCallback(
    (view: SavedView) => {
      replaceFilters(view.filters);
      applyConfig(view.chart);
      if (view.columns) applyView(view.columns);
    },
    [replaceFilters, applyConfig, applyView],
  );

  const handleSave = useCallback(
    (name: string) =>
      presets.savePreset(name, filters, chartConfig, columnViewState),
    [presets, filters, chartConfig, columnViewState],
  );

  return (
    <div className="space-y-3">
      <PresetBar
        views={presets.views}
        onApply={handleApply}
        onSave={handleSave}
        onDelete={presets.deletePreset}
      />

      <FilterBar
        dataset={dataset}
        filters={filters}
        onAdd={filtersApi.addFilter}
        onUpdate={filtersApi.updateFilter}
        onRemove={filtersApi.removeFilter}
        onClear={filtersApi.clearFilters}
        query={query}
        onQueryChange={filtersApi.setQuery}
        resultCount={filteredOrder.length}
        totalCount={dataset.rows.length}
      />

      <div className="flex items-center justify-between gap-2">
        <ColumnManager
          items={columnView.items}
          onToggle={columnView.toggle}
          onMove={columnView.move}
          onShowAll={columnView.showAll}
          onReset={columnView.reset}
        />
        <div className="flex items-center gap-2">
          <ShareButton getView={getView} />
          <ExportButton
            dataset={dataset}
            order={order}
            columns={visibleColumns}
          />
        </div>
      </div>

      <StatsPanel dataset={dataset} order={filteredOrder} />

      <DataTable
        dataset={dataset}
        columns={visibleColumns}
        order={order}
        sort={sort}
        onToggleSort={toggleSort}
      />

      <ErrorBoundary
        fallback={(_error, reset) => (
          <div
            role="alert"
            className="flex h-80 flex-col items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-center"
          >
            <p className="text-sm font-medium text-rose-700">
              Chart failed to render
            </p>
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-rose-300 bg-white px-3 py-1 text-sm font-medium text-rose-700 hover:bg-rose-100"
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
    </div>
  );
}
