import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { Dataset } from '@/types/dataset';
import type { WorkspaceMode } from '@/types/workspace';
import { useLogParser } from '@/features/ingestion/hooks/useLogParser';
import { DropZone } from '@/features/ingestion/components/DropZone';
import { ParseStatus } from '@/features/ingestion/components/ParseStatus';
import { useWorkspace } from '@/features/workspace/hooks/useWorkspace';
import { WorkspaceBar } from '@/features/workspace/components/WorkspaceBar';
import { ChartSkeleton } from '@/components/ChartSkeleton';
import { DataWorkspace } from './DataWorkspace';

const CompareView = lazy(() =>
  import('@/features/compare/components/CompareView').then((m) => ({
    default: m.CompareView,
  })),
);

export function App() {
  const { status, dataset, errors, progress, parseFile, reset } = useLogParser();
  const ws = useWorkspace();
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
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[100rem] items-center gap-2 px-6 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            LV
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight text-slate-900">
              LogVibe
            </h1>
            <p className="text-xs text-slate-500">
              Privacy-first, local CSV &amp; log analyzer
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[100rem] px-6 py-8">
        {!hasFiles ? (
          <div className="py-12">
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
              />
            )}

            {mode === 'compare' && (
              <Suspense
                fallback={
                  <ChartSkeleton className="h-96" label="Loading comparison…" />
                }
              >
                <CompareView files={ws.files} />
              </Suspense>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
