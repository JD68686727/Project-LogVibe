import { btnSecondary } from '@/utils/controls';
import { useI18n } from '@/lib/i18n/I18nContext';
import type { TKey } from '@/lib/i18n/translations';
import { ModalShell } from '@/features/analysis/components/ModalShell';

const SHORTCUTS: { keys: string[]; label: TKey }[] = [
  { keys: ['?'], label: 'shortcuts.help' },
  { keys: ['Esc'], label: 'shortcuts.close' },
  { keys: ['←', '→'], label: 'shortcuts.prevNext' },
  { keys: ['Enter', 'Space'], label: 'shortcuts.open' },
  { keys: ['Shift', '+ click'], label: 'shortcuts.secondarySort' },
  { keys: ['Tab'], label: 'shortcuts.tab' },
];

const kbd =
  'rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300';

/** A quick reference of the app's keyboard shortcuts (opened with `?`). */
export function KeyboardShortcuts({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <ModalShell
      title={t('shortcuts.title')}
      testId="keyboard-shortcuts"
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className={`${btnSecondary} ml-auto`}>
          {t('common.close')}
        </button>
      }
    >
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {SHORTCUTS.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-6 py-2">
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {t(s.label)}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {s.keys.map((k) => (
                <kbd key={k} className={kbd}>
                  {k}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </ModalShell>
  );
}
