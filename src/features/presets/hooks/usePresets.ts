import { useCallback, useEffect, useState } from 'react';
import type { Dataset } from '@/types/dataset';
import type { ChartConfig } from '@/types/chart';
import type { FilterGroup } from '@/types/filter';
import type { PivotConfig } from '@/types/pivot';
import type { ColumnViewItem } from '@/types/table';
import type { SavedView } from '@/types/view';
import {
  deleteView,
  getViews,
  saveView,
  signatureFor,
} from '@/lib/storage/viewStore';

let idCounter = 0;
const nextId = () => `view-${Date.now()}-${++idCounter}`;

export interface UsePresets {
  views: SavedView[];
  savePreset: (
    name: string,
    groups: FilterGroup[],
    chart: ChartConfig,
    columns: ColumnViewItem[],
    pivot: PivotConfig,
  ) => void;
  deletePreset: (id: string) => void;
}

/** Manages the list of saved views for the current dataset's schema. */
export function usePresets(dataset: Dataset): UsePresets {
  const signature = signatureFor(dataset);
  const [views, setViews] = useState<SavedView[]>(() => getViews(signature));

  // Refresh if the schema signature changes within the same mount.
  useEffect(() => {
    setViews(getViews(signature));
  }, [signature]);

  const savePreset = useCallback(
    (
      name: string,
      groups: FilterGroup[],
      chart: ChartConfig,
      columns: ColumnViewItem[],
      pivot: PivotConfig,
    ) => {
      const view: SavedView = {
        id: nextId(),
        name: name.trim(),
        datasetSignature: signature,
        groups,
        chart,
        columns,
        pivot,
        createdAt: Date.now(),
      };
      setViews(saveView(view));
    },
    [signature],
  );

  const deletePreset = useCallback(
    (id: string) => {
      setViews(deleteView(id, signature));
    },
    [signature],
  );

  return { views, savePreset, deletePreset };
}
