import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { Dataset } from '@/types/dataset';
import type { WorkspaceMode } from '@/types/workspace';
import { useLogParser } from '@/features/ingestion/hooks/useLogParser';
import { DropZone } from '@/features/ingestion/components/DropZone';
import { ParseStatus } from '@/features/ingestion/components/ParseStatus';
import { useWorkspace } from '@/features/workspace/hooks/useWorkspace';
import { WorkspaceBar } from '@/features/workspace/components/WorkspaceBar';
import { useSharedView } from '@/features/sharing/hooks/useSharedView';
import { useTheme } from '@/features/theme/hooks/useTheme';
import { ThemeToggle } from '@/features/theme/components/ThemeToggle';
import { ChartSkeleton } from '@/components/ChartSkeleton';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DataWorkspace } from './DataWorkspace';

const CompareView = lazy(() =>
  import('@/features/compare/components/CompareView').then((m) => ({
    default: m.CompareView,
  })),
);

export function App() {
  const { status, dataset, errors, progress, parseFile, reset } = useLogParser();
  const ws = useWorkspace();
  const shared = useSharedView();
  const { theme, setTheme } = useTheme();
  const [mode, setMode] = useState<WorkspaceMode>('analyze');
  const lastAddedRef = useRef<Dataset | null>(null);
  const { addDataset } = ws;

  // When a parse completes, move the dataset into the workspace and clear the
  // parser so it's ready for the next file. The ref guards against re-adding.
  useEffect(() => {
    if (status === 'success' && dataset && dataset !== lastAddedRef.current) {
      lastAddedRef.current = dataset;
      addDataset(dataset);
      reset();
    }
  }, [status, dataset, addDataset, reset]);

  const hasFiles = ws.files.length > 0;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-[100rem] items-center gap-2 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            LV
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight text-slate-900 dark:text-slate-100">
              LogVibe
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Privacy-first, local CSV &amp; log analyzer
            </p>
          </div>
          <div className="ml-auto">
            <ThemeToggle theme={theme} onChange={setTheme} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[100rem] px-4 py-6 sm:px-6 sm:py-8">
        {!hasFiles ? (
          <div className="py-6 sm:py-12">
            <DropZone
              status={status}
              progress={progress}
              onFileSelected={parseFile}
            />
            <ParseStatus
              status={status}
              dataset={null}
              errors={errors}
              onClear={reset}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <WorkspaceBar
              files={ws.files}
              activeId={ws.activeFile?.id ?? null}
              mode={mode}
              parsing={status === 'parsing'}
              progress={progress}
              onSetMode={setMode}
              onSetActive={ws.setActive}
              onRemove={ws.removeFile}
              onAddFile={parseFile}
            />

            {status === 'error' && (
              <ParseStatus
                status="error"
                dataset={null}
                errors={errors}
                onClear={reset}
              />
            )}

            {mode === 'analyze' && ws.activeFile && (
              <DataWorkspace
                key={ws.activeFile.id}
                dataset={ws.activeFile.dataset}
                pending={shared.pending}
                onConsumePending={shared.consume}
              />
            )}

            {mode === 'compare' && (
              <ErrorBoundary
                fallback={(_error, reset) => (
                  <div
                    role="alert"
                    className="flex h-96 flex-col items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-center dark:border-rose-500/30 dark:bg-rose-500/10"
                  >
                    <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
                      Comparison failed to render
                    </p>
                    <button
                      type="button"
                      onClick={reset}
                      className="rounded-md border border-rose-300 bg-white px-3 py-1 text-sm font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-slate-800 dark:text-rose-300 dark:hover:bg-rose-500/20"
                    >
                      Try again
                    </button>
                  </div>
                )}
              >
                <Suspense
                  fallback={
                    <ChartSkeleton className="h-96" label="Loading comparison…" />
                  }
                >
                  <CompareView files={ws.files} />
                </Suspense>
              </ErrorBoundary>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
