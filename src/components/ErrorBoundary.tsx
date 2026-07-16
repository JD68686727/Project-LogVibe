/* eslint-disable react-refresh/only-export-components -- error boundaries must be
   class components, and DefaultFallback is a local helper (Fast Refresh dev-only). */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n/I18nContext';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback; receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render errors in its subtree so a single component failure (e.g. a
 * chart crash) degrades gracefully instead of unmounting the whole app. Stays
 * local-first: errors are logged to the console, never sent anywhere.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, info.componentStack);
  }

  reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return <DefaultFallback error={error} onReset={this.reset} />;
  }
}

function DefaultFallback({
  error,
  onReset,
}: {
  error: Error;
  onReset: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      className="mx-auto mt-16 max-w-lg rounded-xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-500/30 dark:bg-rose-500/10"
    >
      <p className="text-base font-semibold text-rose-800 dark:text-rose-300">
        {t('error.title')}
      </p>
      <p className="mt-1 break-words text-sm text-rose-600 dark:text-rose-400">
        {error.message}
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {t('error.retry')}
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          {t('error.reload')}
        </button>
      </div>
    </div>
  );
}
