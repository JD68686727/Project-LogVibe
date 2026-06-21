import { useCallback, useRef, useState, type DragEvent } from 'react';
import type { ParseStatus } from '@/types/dataset';
import { cn } from '@/utils/cn';
import { ACCEPTED, validateFile } from '../acceptedTypes';

export interface DropZoneProps {
  status: ParseStatus;
  progress: number;
  onFileSelected: (file: File) => void;
}

/**
 * Presentational drag-and-drop zone. Holds only local drag/rejection UI state —
 * all parsing logic lives in `useLogParser`, owned by the parent. This keeps the
 * dataset available to sibling features (table, charts) without prop drilling
 * through the upload control.
 */
export function DropZone({ status, progress, onFileSelected }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      setRejected(null);
      const file = files?.[0];
      if (!file) return;
      const validation = validateFile(file);
      if (!validation.ok) {
        setRejected(validation.reason);
        return;
      }
      onFileSelected(file);
    },
    [onFileSelected],
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  const isParsing = status === 'parsing';

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a CSV or log file"
        aria-busy={isParsing}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={cn(
          'group relative flex flex-col items-center justify-center',
          'rounded-2xl border-2 border-dashed px-8 py-16 text-center',
          'cursor-pointer outline-none transition-all duration-200',
          'focus-visible:ring-4 focus-visible:ring-brand-500/30',
          isDragging
            ? 'scale-[1.01] border-brand-500 bg-brand-50'
            : 'border-slate-300 bg-slate-50 hover:border-brand-500 hover:bg-white',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div
          className={cn(
            'mb-4 flex h-16 w-16 items-center justify-center rounded-full transition-colors',
            isDragging
              ? 'bg-brand-500 text-white'
              : 'bg-white text-brand-600 shadow-sm group-hover:bg-brand-500 group-hover:text-white',
          )}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
            />
          </svg>
        </div>

        {isParsing ? (
          <>
            <p className="text-base font-medium text-slate-700">Parsing your file…</p>
            <div className="mt-4 h-2 w-56 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-brand-500 transition-[width] duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">{progress}%</p>
          </>
        ) : (
          <>
            <p className="text-base font-semibold text-slate-800">
              Drop your CSV or log file here
            </p>
            <p className="mt-1 text-sm text-slate-500">
              or <span className="font-medium text-brand-600">browse</span> to upload
            </p>
            <p className="mt-3 text-xs text-slate-400">
              {ACCEPTED.join(' · ')} — processed 100% locally, nothing leaves your
              browser
            </p>
          </>
        )}
      </div>

      {rejected && (
        <p className="mt-3 text-sm font-medium text-rose-600">{rejected}</p>
      )}
    </div>
  );
}
