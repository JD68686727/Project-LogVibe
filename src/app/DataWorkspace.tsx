import { lazy, Suspense, useCallback } from 'react';
import type { Dataset } from '@/types/dataset';
import type { SavedView } from '@/types/view';
import { useFilters } from '@/features/filtering/hooks/useFilters';
import { FilterBar } from '@/features/filtering/components/FilterBar';
import { useSortedRows } from '@/features/table/hooks/useSortedRows';
import { DataTable } from '@/features/table/components/DataTable';
import { ExportButton } from '@/features/export/components/ExportButton';
import { StatsPanel } from '@/features/stats/components/StatsPanel';
import { useChartConfig } from '@/features/visualization/hooks/useChartConfig';
import { usePresets } from '@/features/presets/hooks/usePresets';
import { PresetBar } from '@/features/presets/components/PresetBar';
import { ChartSkeleton } from '@/components/ChartSkeleton';

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
}

/**
 * Orchestrates the data view. Filtering feeds its surviving row indices into
 * sorting (drives the table) and into the chart aggregation. Filter + chart
 * state live here so presets can snapshot and restore both at once. Every stage
 * works on index arrays, so a 50k-row dataset is never copied. Mounted with a
 * `key` tied to the dataset in App, so a new file gets fresh state for free.
 */
export function DataWorkspace({ dataset }: DataWorkspaceProps) {
  const filtersApi = useFilters(dataset);
  const chart = useChartConfig(dataset, filtersApi.filteredOrder);
  const presets = usePresets(dataset);
  const { order, sort, toggleSort } = useSortedRows(dataset, filtersApi.filteredOrder);

  const { replaceFilters, filters, filteredOrder } = filtersApi;
  const { applyConfig, config: chartConfig } = chart;

  const handleApply = useCallback(
    (view: SavedView) => {
      replaceFilters(view.filters);
      applyConfig(view.chart);
    },
    [replaceFilters, applyConfig],
  );

  const handleSave = useCallback(
    (name: string) => presets.savePreset(name, filters, chartConfig),
    [presets, filters, chartConfig],
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
        resultCount={filteredOrder.length}
        totalCount={dataset.rows.length}
      />

      <div className="flex items-center justify-end">
        <ExportButton dataset={dataset} order={order} />
      </div>

      <StatsPanel dataset={dataset} order={filteredOrder} />

      <DataTable
        dataset={dataset}
        order={order}
        sort={sort}
        onToggleSort={toggleSort}
      />

      <Suspense fallback={<ChartSkeleton className="h-80" />}>
        <ChartPanel dataset={dataset} chart={chart} />
      </Suspense>
    </div>
  );
}
