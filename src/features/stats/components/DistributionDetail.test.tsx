// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ColumnDistribution } from '@/types/stats';
import { I18nProvider } from '@/lib/i18n/I18nContext';
import { DistributionDetail } from './DistributionDetail';

const numeric: ColumnDistribution = {
  kind: 'numeric',
  bins: [3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
  min: 0,
  max: 120,
};

const categorical: ColumnDistribution = {
  kind: 'categorical',
  top: [
    { value: 'INFO', count: 9 },
    { value: 'WARN', count: 3 },
  ],
  othersCount: 3,
  total: 15,
};

describe('DistributionDetail', () => {
  it('emits a between filter when a histogram bar is clicked', async () => {
    const onPick = vi.fn();
    render(
      <DistributionDetail
        column={{ key: 'latency', name: 'latency', type: 'number' }}
        dist={numeric}
        onPick={onPick}
      />,
      { wrapper: I18nProvider },
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Filter latency 0 to 10' }),
    );
    expect(onPick).toHaveBeenCalledWith({
      columnKey: 'latency',
      operator: 'between',
      value: '0',
      value2: '10',
    });
  });

  it('emits an equals filter when a categorical value is clicked', async () => {
    const onPick = vi.fn();
    render(
      <DistributionDetail
        column={{ key: 'level', name: 'level', type: 'string' }}
        dist={categorical}
        onPick={onPick}
      />,
      { wrapper: I18nProvider },
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Filter level = INFO' }),
    );
    expect(onPick).toHaveBeenCalledWith({
      columnKey: 'level',
      operator: 'equals',
      value: 'INFO',
    });
  });

  it('renders an "others" remainder that is not clickable', () => {
    render(
      <DistributionDetail
        column={{ key: 'level', name: 'level', type: 'string' }}
        dist={categorical}
        onPick={vi.fn()}
      />,
      { wrapper: I18nProvider },
    );
    // Two value buttons (INFO, WARN); "others" is plain text, not a button.
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByText('others')).toBeInTheDocument();
  });
});
