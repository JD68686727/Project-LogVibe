import { useRef } from 'react';
import type { LoadedFile, WorkspaceMode } from '@/types/workspace';
import { cn } from '@/utils/cn';
import { ACCEPTED, validateFile } from '@/features/ingestion/acceptedTypes';

export interface WorkspaceBarProps {
  files: LoadedFile[];
  activeId: string | null;
  mode: WorkspaceMode;
  parsing: boolean;
  progress: number;
  onSetMode: (mode: WorkspaceMode) => void;
  onSetActive: (id: string) => void;
  onRemove: (id: string) => void;
  onAddFile: (file: File) => void;
}

const MODES: { value: WorkspaceMode; label: string }[] = [
  { value: 'analyze', label: 'Analyze' },
  { value: 'compare', label: 'Compare' },
];

export function WorkspaceBar({
  files,
  activeId,
  mode,
  parsing,
  progress,
  onSetMode,
  onSetActive,
  onRemove,
  onAddFile,
}: WorkspaceBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePick = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (file && validateFile(file).ok) onAddFile(file);
    if (inputRef.current) inputRef.current.value = ''; // allow re-picking same file
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
      {/* File tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        {files.map((f) => {
          const active = f.id === activeId && mode === 'analyze';
          return (
            <span
              key={f.id}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors',
                active
                  ? 'border-brand-300 bg-brand-50 text-brand-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              <button
                type="button"
                onClick={() => onSetActive(f.id)}
                className="flex items-center gap-2"
                title={`${f.dataset.meta.fileName} · ${f.dataset.meta.rowCount.toLocaleString()} rows`}
              >
                <span className="max-w-[14rem] truncate font-medium">
                  {f.dataset.meta.fileName}
                </span>
                <span className="text-xs text-slate-400">
                  {f.dataset.meta.rowCount.toLocaleString()}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onRemove(f.id)}
                aria-label={`Remove ${f.dataset.meta.fileName}`}
                className="flex h-4 w-4 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3 w-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </span>
          );
        })}

        {/* Add file */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={parsing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-500 hover:border-brand-400 hover:text-brand-600 disabled:opacity-50"
        >
          {parsing ? `Parsing… ${progress}%` : '+ Add file'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          className="hidden"
          onChange={(e) => handlePick(e.target.files)}
        />
      </div>

      {/* Mode toggle */}
      <div className="ml-auto inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onSetMode(m.value)}
            className={cn(
              'rounded-md px-3 py-1 text-sm font-medium transition-colors',
              mode === m.value
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
