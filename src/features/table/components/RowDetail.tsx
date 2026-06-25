import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { CellValue, ColumnType, Dataset } from '@/types/dataset';
import { cn } from '@/utils/cn';
import { categoricalFilter, type NewFilter } from '@/lib/stats/distributionFilter';
import { formatCell } from '../utils/formatCell';

const TYPE_BADGE: Record<ColumnType, string> = {
  string: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  number: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
  boolean: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  date: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
};

const iconBtn =
  'flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200';

export interface RowDetailProps {
  dataset: Dataset;
  /** Filtered + sorted display order, for prev/next stepping. */
  order: number[];
  /** The dataset row index currently shown. */
  rowIdx: number;
  onNavigate: (rowIdx: number) => void;
  onClose: () => void;
  /** When set, each field offers a "filter to this value" action. */
  onAddFilter?: (filter: NewFilter) => void;
}

function filterFor(key: string, type: ColumnType, value: CellValue): NewFilter {
  if (value == null || value === '') {
    return { columnKey: key, operator: 'isEmpty', value: '' };
  }
  return categoricalFilter(key, type, String(value));
}

/** A slide-in panel showing every field of one row, with prev/next + actions. */
export function RowDetail({
  dataset,
  order,
  rowIdx,
  onNavigate,
  onClose,
  onAddFilter,
}: RowDetailProps) {
  const pos = order.indexOf(rowIdx);
  const inView = pos !== -1;
  const row = dataset.rows[rowIdx];

  const goPrev = () => {
    if (inView && pos > 0) onNavigate(order[pos - 1]);
  };
  const goNext = () => {
    if (inView && pos < order.length - 1) onNavigate(order[pos + 1]);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') goPrev();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const copy = (value: CellValue) => {
    void navigator.clipboard?.writeText(value == null ? '' : String(value));
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close row detail"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Row detail"
        data-testid="row-detail"
        className="relative flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Row {(rowIdx + 1).toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {inView
                ? `${(pos + 1).toLocaleString()} of ${order.length.toLocaleString()} in view`
                : 'not in the current filtered view'}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={goPrev}
              disabled={!inView || pos === 0}
              aria-label="Previous row"
              className={iconBtn}
            >
              ↑
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={!inView || pos >= order.length - 1}
              aria-label="Next row"
              className={iconBtn}
            >
              ↓
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={iconBtn}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 divide-y divide-slate-100 overflow-auto dark:divide-slate-800">
          {dataset.columns.map((col) => {
            const value = row[dataset.columnIndex[col.key]];
            const fc = formatCell(value, col.type);
            return (
              <div key={col.key} className="group px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                    {col.name}
                  </span>
                  <span
                    className={cn(
                      'rounded px-1 py-0.5 text-[10px] font-medium',
                      TYPE_BADGE[col.type],
                    )}
                  >
                    {col.type}
                  </span>
                  <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    {onAddFilter && (
                      <button
                        type="button"
                        onClick={() => {
                          onAddFilter(filterFor(col.key, col.type, value));
                          onClose();
                        }}
                        aria-label={`Filter by ${col.name}`}
                        className="rounded px-1.5 py-0.5 text-[11px] font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
                      >
                        Filter
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => copy(value)}
                      aria-label={`Copy ${col.name}`}
                      className="rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <p
                  className={cn(
                    'mt-0.5 whitespace-pre-wrap break-words text-sm',
                    fc.muted
                      ? 'text-slate-300 dark:text-slate-600'
                      : 'text-slate-800 dark:text-slate-100',
                    col.type === 'number' && 'font-mono tabular-nums',
                  )}
                >
                  {fc.text}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
