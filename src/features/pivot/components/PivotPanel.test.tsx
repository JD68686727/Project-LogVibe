// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Dataset } from '@/types/dataset';
import type { NewFilter } from '@/lib/stats/distributionFilter';
import { makeDataset, allRows } from '@/test/factory';
import { usePivotConfig } from '../hooks/usePivotConfig';
import { PivotPanel } from './PivotPanel';

const ds = makeDataset(
  [
    { name: 'a', key: 'a', type: 'string' },
    { name: 'b', key: 'b', type: 'string' },
  ],
  [
    ['x', 'p'],
    ['x', 'q'],
    ['y', 'p'],
  ],
);

/** Supplies the controlled pivot config the way DataWorkspace does. */
function Harness({
  dataset = ds,
  onAddFilter,
}: {
  dataset?: Dataset;
  onAddFilter?: (filter: NewFilter) => void;
}) {
  const pivot = usePivotConfig(dataset);
  return (
    <PivotPanel
      dataset={dataset}
      order={allRows(dataset)}
      pivot={pivot}
      onAddFilter={onAddFilter}
    />
  );
}

describe('PivotPanel', () => {
  it('is collapsed until the header is clicked', () => {
    render(<Harness />);
    expect(screen.queryByTestId('pivot-table')).not.toBeInTheDocument();
  });

  it('clicking a cell filters to that row × column (two filters)', async () => {
    const onAddFilter = vi.fn();
    render(<Harness onAddFilter={onAddFilter} />);

    await userEvent.click(screen.getByRole('button', { name: 'Pivot table' }));
    expect(screen.getByTestId('pivot-table')).toBeInTheDocument();

    // Default rows=a, cols=b; the x×p cell holds a count of 1.
    await userEvent.click(screen.getByRole('button', { name: 'Filter x × p' }));

    expect(onAddFilter).toHaveBeenCalledTimes(2);
    expect(onAddFilter.mock.calls[0][0]).toEqual({
      columnKey: 'a',
      operator: 'equals',
      value: 'x',
    });
    expect(onAddFilter.mock.calls[1][0]).toEqual({
      columnKey: 'b',
      operator: 'equals',
      value: 'p',
    });
  });

  it('does not render empty cells as filter buttons', async () => {
    render(<Harness onAddFilter={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Pivot table' }));
    // y×q has a count of 0 → no button for it.
    expect(
      screen.queryByRole('button', { name: 'Filter y × q' }),
    ).not.toBeInTheDocument();
  });
});
