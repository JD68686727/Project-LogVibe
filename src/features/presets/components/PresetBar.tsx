import { useState, type FormEvent } from 'react';
import type { SavedView } from '@/types/view';
import { useI18n } from '@/lib/i18n/I18nContext';

const inputCls =
  'w-40 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200';

export interface PresetBarProps {
  views: SavedView[];
  onApply: (view: SavedView) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
}

/** Save / apply / delete named filter+chart presets for the current schema. */
export function PresetBar({ views, onApply, onSave, onDelete }: PresetBarProps) {
  const { t } = useI18n();
  const [name, setName] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName('');
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        {t('preset.saved')}
      </span>

      {views.length === 0 ? (
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {t('preset.none')}
        </span>
      ) : (
        views.map((v) => (
          <span
            key={v.id}
            className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-sm text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
          >
            <button
              type="button"
              onClick={() => onApply(v)}
              className="font-medium hover:underline"
              title={t('preset.apply')}
            >
              {v.name}
            </button>
            <button
              type="button"
              onClick={() => onDelete(v.id)}
              aria-label={t('preset.delete', { name: v.name })}
              className="flex h-5 w-5 items-center justify-center rounded-full text-brand-400 hover:bg-brand-100 hover:text-rose-600 dark:hover:bg-brand-500/25 dark:hover:text-rose-400"
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
        ))
      )}

      <form onSubmit={submit} className="ml-auto flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('preset.namePlaceholder')}
          aria-label={t('preset.nameAria')}
          className={inputCls}
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          {t('preset.save')}
        </button>
      </form>
    </div>
  );
}
