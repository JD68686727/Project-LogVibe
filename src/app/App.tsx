import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { Dataset } from '@/types/dataset';
import type { WorkspaceMode } from '@/types/workspace';
import { useLogParser } from '@/features/ingestion/hooks/useLogParser';
import { DropZone } from '@/features/ingestion/components/DropZone';
import { ParseStatus } from '@/features/ingestion/components/ParseStatus';
import { LogPatternBuilder } from '@/features/ingestion/components/LogPatternBuilder';
import { ConfigAuditModal } from '@/features/config/components/ConfigAuditModal';
import { SAMPLES, sampleToFile } from '@/features/ingestion/sampleData';
import { useTailFile } from '@/features/ingestion/hooks/useTailFile';
import { TailControls } from '@/features/ingestion/components/TailControls';
import { useLiveScan } from '@/features/security/hooks/useLiveScan';
import { useFindingAlerts } from '@/features/security/hooks/useFindingAlerts';
import { requestNotifyPermission } from '@/lib/alert/notify';
import { KeyboardShortcuts } from '@/features/help/components/KeyboardShortcuts';
import { SettingsPanel } from '@/features/settings/components/SettingsPanel';
import { useWorkspace } from '@/features/workspace/hooks/useWorkspace';
import { WorkspaceBar } from '@/features/workspace/components/WorkspaceBar';
import { useSharedView } from '@/features/sharing/hooks/useSharedView';
import { useTheme } from '@/features/theme/hooks/useTheme';
import { ThemeToggle } from '@/features/theme/components/ThemeToggle';
import { useTimezone } from '@/features/time/hooks/useTimezone';
import { TimezoneSelect } from '@/features/time/components/TimezoneSelect';
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
  const { tz, setTimezone } = useTimezone();
  const [mode, setMode] = useState<WorkspaceMode>('analyze');
  const [showBuilder, setShowBuilder] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const lastAddedRef = useRef<Dataset | null>(null);
  const { addDataset } = ws;
  const tail = useTailFile({
    addDataset: ws.addDataset,
    updateDataset: ws.updateDataset,
  });
  // Auto-scan the growing tailed file so threat findings update live.
  const tailedDataset =
    tail.active && ws.activeFile && tail.fileId === ws.activeFile.id
      ? ws.activeFile.dataset
      : null;
  const liveScan = useLiveScan(tailedDataset, tail.active);
  const [alertsOn, setAlertsOn] = useState(() => {
    try {
      return localStorage.getItem('logvibe.alerts') === '1';
    } catch {
      return false;
    }
  });
  const toggleAlerts = async () => {
    const next = !alertsOn;
    if (next) await requestNotifyPermission();
    try {
      localStorage.setItem('logvibe.alerts', next ? '1' : '0');
    } catch {
      // storage unavailable — keep the in-memory preference
    }
    setAlertsOn(next);
  };
  useFindingAlerts(liveScan.findings, { enabled: alertsOn && tail.active });

  // A derived dataset (custom-log parse, security-scan findings, config audit)
  // bypasses the CSV parser and is added to the workspace directly.
  const openDerivedDataset = (ds: Dataset) => {
    addDataset(ds);
    setMode('analyze');
  };

  const handleCustomDataset = (ds: Dataset) => {
    openDerivedDataset(ds);
    setShowBuilder(false);
  };

  const handleAuditDataset = (ds: Dataset) => {
    openDerivedDataset(ds);
    setShowAudit(false);
  };

  // When a parse completes, move the dataset into the workspace and clear the
  // parser so it's ready for the next file. The ref guards against re-adding.
  useEffect(() => {
    if (status === 'success' && dataset && dataset !== lastAddedRef.current) {
      lastAddedRef.current = dataset;
      addDataset(dataset);
      reset();
    }
  }, [status, dataset, addDataset, reset]);

  // `?` opens the keyboard-shortcuts sheet (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?') return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      )
        return;
      setShowShortcuts(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
          <div className="ml-auto flex items-center gap-3">
            <TimezoneSelect tz={tz} onChange={setTimezone} />
            <ThemeToggle theme={theme} onChange={setTheme} />
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              aria-label="Settings"
              title="Settings"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setShowShortcuts(true)}
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              ?
            </button>
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
            <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
              Unstructured log (Nginx, Apache, syslog…)?{' '}
              <button
                type="button"
                onClick={() => setShowBuilder(true)}
                className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              >
                Build a custom log format
              </button>
            </p>
            <p className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
              Have a server config (SSH, INI…)?{' '}
              <button
                type="button"
                onClick={() => setShowAudit(true)}
                className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              >
                Audit it for hardening issues
              </button>
            </p>
            {tail.supported && (
              <p className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
                Watching a log that keeps growing?{' '}
                <button
                  type="button"
                  onClick={() => void tail.start()}
                  className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  Tail it live
                </button>
              </p>
            )}

            <div className="mx-auto mt-8 max-w-2xl">
              <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Or try a sample — nothing is uploaded
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {SAMPLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => parseFile(sampleToFile(s))}
                    className="flex flex-col gap-0.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-brand-400 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500 dark:hover:bg-brand-500/10"
                  >
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {s.label}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {s.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
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
              onCustomLog={() => setShowBuilder(true)}
              onAuditConfig={() => setShowAudit(true)}
              onTailFile={tail.supported ? () => void tail.start() : undefined}
            />

            {tail.active && ws.activeFile && tail.fileId === ws.activeFile.id && (
              <TailControls
                fileName={tail.fileName ?? ws.activeFile.dataset.meta.fileName}
                paused={tail.paused}
                atCap={tail.atCap}
                findingCount={liveScan.count}
                alertsOn={alertsOn}
                onToggleAlerts={() => void toggleAlerts()}
                onPause={tail.pause}
                onResume={tail.resume}
                onStop={tail.stop}
              />
            )}

            {tail.error && (
              <p
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
              >
                {tail.error}
              </p>
            )}

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
                onRetypeColumn={(columnKey, type) =>
                  ws.setColumnType(ws.activeFile!.id, columnKey, type)
                }
                onAddDerivedColumn={(spec) =>
                  ws.addDerivedColumn(ws.activeFile!.id, spec)
                }
                onRemoveColumn={(columnKey) =>
                  ws.removeColumn(ws.activeFile!.id, columnKey)
                }
                onApplyDerivedSpecs={(specs) =>
                  ws.applyDerivedSpecs(ws.activeFile!.id, specs)
                }
                onOpenDataset={openDerivedDataset}
                timeZone={tz}
                autoScroll={tail.active && tail.fileId === ws.activeFile.id}
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
                  <CompareView files={ws.files} timeZone={tz} />
                </Suspense>
              </ErrorBoundary>
            )}
          </div>
        )}
      </main>

      {showBuilder && (
        <LogPatternBuilder
          onDataset={handleCustomDataset}
          onClose={() => setShowBuilder(false)}
          onTailFile={
            tail.supported
              ? (pattern) => {
                  setShowBuilder(false);
                  void tail.start(pattern);
                }
              : undefined
          }
        />
      )}

      {showAudit && (
        <ConfigAuditModal
          onFindings={handleAuditDataset}
          onClose={() => setShowAudit(false)}
        />
      )}

      {showSettings && (
        <SettingsPanel
          theme={theme}
          onThemeChange={setTheme}
          tz={tz}
          onTimezoneChange={setTimezone}
          alertsOn={alertsOn}
          onToggleAlerts={toggleAlerts}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showShortcuts && (
        <KeyboardShortcuts onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  );
}
