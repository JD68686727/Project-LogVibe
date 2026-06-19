import { useMemo } from 'react';
import type { Dataset } from '@/types/dataset';
import type { ColumnStats } from '@/types/stats';
import { computeColumnStats } from '@/lib/stats/computeColumnStats';

/**
 * Memoized column profile. `enabled` gates the work so the (O(rows × columns))
 * pass only runs while the panel is open — collapsed, filtering/sorting costs
 * nothing here.
 */
export function useColumnStats(
  dataset: Dataset,
  order: number[],
  enabled: boolean,
): ColumnStats[] | null {
  return useMemo(
    () => (enabled ? computeColumnStats(dataset, order) : null),
    [enabled, dataset, order],
  );
}
