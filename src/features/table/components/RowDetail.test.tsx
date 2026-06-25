// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeDataset } from '@/test/factory';
import { RowDetail } from './RowDetail';

const ds = makeDataset(
  [
    { name: 'level', key: 'level', type: 'string' },
    { name: 'code', key: 'code', type: 'number' },
  ],
  [
    ['INFO', 200],
    ['ERROR', 500],
  ],
);
const order = [0, 1];

describe('RowDetail', () => {
  it('shows every field of the selected row', () => {
    render(
      <RowDetail
        dataset={ds}
        order={order}
        rowIdx={0}
        onNavigate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const panel = screen.getByTestId('row-detail');
    expect(panel).toHaveTextContent('INFO');
    expect(panel).toHaveTextContent('200');
    expect(panel).toHaveTextContent('1 of 2 in view');
  });

  it('steps to the next row in display order', async () => {
    const onNavigate = vi.fn();
    render(
      <RowDetail
        dataset={ds}
        order={order}
        rowIdx={0}
        onNavigate={onNavigate}
        onClose={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByLabelText('Next row'));
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it('filters by a field value and closes', async () => {
    const onAddFilter = vi.fn();
    const onClose = vi.fn();
    render(
      <RowDetail
        dataset={ds}
        order={order}
        rowIdx={1}
        onNavigate={vi.fn()}
        onClose={onClose}
        onAddFilter={onAddFilter}
      />,
    );
    await userEvent.click(screen.getByLabelText('Filter by level'));
    expect(onAddFilter).toHaveBeenCalledWith({
      columnKey: 'level',
      operator: 'equals',
      value: 'ERROR',
    });
    expect(onClose).toHaveBeenCalled();
  });
});
