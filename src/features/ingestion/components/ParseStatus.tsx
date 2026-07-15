import type { Dataset, ParseError, ParseStatus as Status } from '@/types/dataset';
import { formatBytes } from '@/utils/formatBytes';
import { formatInt } from '@/utils/formatNumber';
import { useI18n } from '@/lib/i18n/I18nContext';

export interface ParseStatusProps {
  status: Status;
  dataset: Dataset | null;
  errors: ParseError[];
  onClear: () => void;
}

/** Renders post-parse feedback: error list on failure, dataset summary on success. */
export function ParseStatus({ status, dataset, errors, onClear }: ParseStatusProps) {
  const { t } = useI18n();
  if (status === 'error') {
    return (
      <div className="mx-auto mt-4 w-full max-w-2xl rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-500/30 dark:bg-rose-500/10">
        <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
          {t('parse.failed')}
        </p>
        <ul className="mt-1 list-inside list-disc text-xs text-rose-600 dark:text-rose-400">
          {errors.slice(0, 5).map((err, i) => (
            <li key={`${err.code}-${i}`}>{err.message}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (status === 'success' && dataset) {
    return (
      <div className="flex w-full items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
        <div className="text-sm">
          <p className="font-semibold text-emerald-800 dark:text-emerald-300">
            {dataset.meta.fileName}
          </p>
          <p className="text-emerald-600 dark:text-emerald-400">
            {t('parse.summary', {
              rows: formatInt(dataset.meta.rowCount),
              cols: dataset.columns.length,
              size: formatBytes(dataset.meta.fileSize),
            })}
            {dataset.meta.truncated && t('parse.truncated')}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
        >
          {t('common.clear')}
        </button>
      </div>
    );
  }

  return null;
}
