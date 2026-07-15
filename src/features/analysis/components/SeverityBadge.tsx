import type { Severity } from '@/lib/analysis/findings';
import { useI18n } from '@/lib/i18n/I18nContext';
import type { TKey } from '@/lib/i18n/translations';

const CLS: Record<Severity, string> = {
  critical: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

const LABEL: Record<Severity, TKey> = {
  critical: 'sev.critical',
  high: 'sev.high',
  medium: 'sev.medium',
  low: 'sev.low',
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const { t } = useI18n();
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CLS[severity]}`}
    >
      {t(LABEL[severity])}
    </span>
  );
}
