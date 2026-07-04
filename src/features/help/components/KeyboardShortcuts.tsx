import { btnSecondary } from '@/utils/controls';
import { ModalShell } from '@/features/analysis/components/ModalShell';

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['?'], label: 'Show this help' },
  { keys: ['Esc'], label: 'Close a dialog or the row detail' },
  { keys: ['←', '→'], label: 'Previous / next row (in the row detail)' },
  { keys: ['Enter', 'Space'], label: 'Open the focused row’s detail' },
  { keys: ['Shift', '+ click'], label: 'Add a secondary sort (table header)' },
  { keys: ['Tab'], label: 'Move between controls (dialogs trap focus)' },
];

const kbd =
  'rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300';

/** A quick reference of the app's keyboard shortcuts (opened with `?`). */
export function KeyboardShortcuts({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell
      title="Keyboard shortcuts"
      testId="keyboard-shortcuts"
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className={`${btnSecondary} ml-auto`}>
          Close
        </button>
      }
    >
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {SHORTCUTS.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-6 py-2">
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {s.label}
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
