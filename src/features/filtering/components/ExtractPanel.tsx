import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Dataset } from '@/types/dataset';
import { formatNumber } from '@/utils/formatNumber';
import { extractMatches, type QuickPattern } from '@/lib/filter/patternLibrary';
import { useI18n } from '@/lib/i18n/I18nContext';

export interface ExtractPanelProps {
  dataset: Dataset;
  /** Filtered row indices to scan. */
  order: number[];
  pattern: QuickPattern;
  /** Filter the view to rows containing this value (cross-column substring). */
  onPickValue: (value: string) => void;
  onClose: () => void;
}

/** A drawer listing every distinct match of a pattern, with occurrence counts. */
export function ExtractPanel({
  dataset,
  order,
  pattern,
  onPickValue,
  onClose,
}: ExtractPanelProps) {
  const { t } = useI18n();
  const matches = useMemo(
    () => extractMatches(dataset, order, pattern),
    [dataset, order, pattern],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copyAll = () => {
    void navigator.clipboard?.writeText(matches.map((m) => m.value).join('\n'));
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label={t('common.close')}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('extract.title', { name: t(pattern.label) })}
        data-testid="extract-panel"
        className="relative flex h-full w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {t(pattern.label)}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {t('extract.distinct', { n: formatNumber(matches.length) })}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={copyAll}
              disabled={matches.length === 0}
              className="rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-40 dark:text-brand-400 dark:hover:bg-brand-500/10"
            >
              {t('extract.copyAll')}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              ✕
            </button>
          </div>
        </div>

        {matches.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
            {t('extract.none')}
          </p>
        ) : (
          <ul className="flex-1 divide-y divide-slate-100 overflow-auto dark:divide-slate-800">
            {matches.map((m) => (
              <li key={m.value}>
                <button
                  type="button"
                  onClick={() => onPickValue(m.value)}
                  aria-label={t('extract.filterBy', { value: m.value })}
                  className="flex w-full items-center gap-2 px-4 py-1.5 text-left hover:bg-brand-50/50 dark:hover:bg-slate-800/60"
                >
                  <span className="flex-1 truncate font-mono text-xs text-slate-700 dark:text-slate-200">
                    {m.value}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-slate-400 dark:text-slate-500">
                    {formatNumber(m.count)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
}
