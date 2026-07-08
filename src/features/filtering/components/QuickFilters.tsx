import { useEffect, useRef, useState } from 'react';
import { PATTERN_LIBRARY, type QuickPattern } from '@/lib/filter/patternLibrary';
import { useI18n } from '@/lib/i18n/I18nContext';

export interface QuickFiltersProps {
  /** Apply a pattern as a regex search (one-click filter). */
  onFilter: (pattern: QuickPattern) => void;
  /** Open the extract list for a pattern. */
  onExtract: (pattern: QuickPattern) => void;
}

const actionBtn =
  'rounded px-1.5 py-0.5 text-[11px] font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10';

/** Dropdown of ready-made patterns (IPv4, MAC, e-mail, HTTP errors…). */
export function QuickFilters({ onFilter, onExtract }: QuickFiltersProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-slate-400 dark:text-slate-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
        </svg>
        {t('filter.quick.title')}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {PATTERN_LIBRARY.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <div className="flex-1 truncate">
                <div className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                  {t(p.label)}
                </div>
                <div className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                  {t(p.hint)}
                </div>
              </div>
              <button
                type="button"
                aria-label={t('filter.quick.filterAria', { name: t(p.label) })}
                onClick={() => {
                  onFilter(p);
                  setOpen(false);
                }}
                className={actionBtn}
              >
                {t('filter.quick.filter')}
              </button>
              <button
                type="button"
                aria-label={t('filter.quick.extractAria', { name: t(p.label) })}
                onClick={() => {
                  onExtract(p);
                  setOpen(false);
                }}
                className="rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                {t('filter.quick.extract')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
