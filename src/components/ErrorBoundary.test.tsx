// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '@/lib/i18n/I18nContext';
import { ErrorBoundary } from './ErrorBoundary';

function Boom(): never {
  throw new Error('kaboom');
}

// The app mounts the boundary inside I18nProvider so its fallback is translated.
const wrapper = I18nProvider;

beforeEach(() => {
  // React logs caught errors; keep test output clean.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
      { wrapper },
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('shows the default fallback with the error message when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
      { wrapper },
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('kaboom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('renders a custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={(error) => <p>custom: {error.message}</p>}>
        <Boom />
      </ErrorBoundary>,
      { wrapper },
    );
    expect(screen.getByText('custom: kaboom')).toBeInTheDocument();
  });

  it('recovers after "Try again" once the child stops throwing', async () => {
    const user = userEvent.setup();
    let shouldThrow = true;
    function Maybe() {
      if (shouldThrow) throw new Error('boom');
      return <p>recovered</p>;
    }

    render(
      <ErrorBoundary>
        <Maybe />
      </ErrorBoundary>,
      { wrapper },
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    shouldThrow = false; // fix the underlying condition, then retry
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('recovered')).toBeInTheDocument();
  });
});
