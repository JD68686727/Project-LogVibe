// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColumnManager } from './ColumnManager';
import { I18nProvider } from '@/lib/i18n/I18nContext';
import type { ColumnManagerItem } from '../hooks/useColumnView';

const baseItems: ColumnManagerItem[] = [
  { key: 'a', name: 'Alpha', visible: true, type: 'string' },
  { key: 'b', name: 'Beta', visible: true, type: 'number' },
  { key: 'c', name: 'Gamma', visible: false, type: 'string' },
];

function renderManager(items: ColumnManagerItem[] = baseItems) {
  const handlers = {
    onToggle: vi.fn(),
    onMove: vi.fn(),
    onShowAll: vi.fn(),
    onReset: vi.fn(),
  };
  render(
    <I18nProvider>
      <ColumnManager items={items} {...handlers} />
    </I18nProvider>,
  );
  return handlers;
}

describe('ColumnManager', () => {
  it('shows the visible/total count and opens the dropdown', async () => {
    const user = userEvent.setup();
    renderManager();
    expect(screen.getByText('2/3')).toBeInTheDocument();
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Columns/ }));
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('fires onToggle with the column key', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderManager();
    await user.click(screen.getByRole('button', { name: /Columns/ }));
    await user.click(screen.getByRole('checkbox', { name: 'Beta' }));
    expect(onToggle).toHaveBeenCalledWith('b');
  });

  it('disables the last visible column so one always remains', async () => {
    const user = userEvent.setup();
    renderManager([
      { key: 'a', name: 'Alpha', visible: true, type: 'string' },
      { key: 'b', name: 'Beta', visible: false, type: 'string' },
    ]);
    await user.click(screen.getByRole('button', { name: /Columns/ }));
    expect(screen.getByRole('checkbox', { name: 'Alpha' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Beta' })).toBeEnabled();
  });

  it('disables move-up on the first row and move-down on the last', async () => {
    const user = userEvent.setup();
    renderManager();
    await user.click(screen.getByRole('button', { name: /Columns/ }));
    expect(screen.getByRole('button', { name: 'Move Alpha up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Gamma down' })).toBeDisabled();
  });

  it('closes on an outside click', async () => {
    const user = userEvent.setup();
    renderManager();
    await user.click(screen.getByRole('button', { name: /Columns/ }));
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
  });
});
