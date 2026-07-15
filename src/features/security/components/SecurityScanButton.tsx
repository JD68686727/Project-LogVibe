import { useState } from 'react';
import type { Dataset } from '@/types/dataset';
import { btnSecondary } from '@/utils/controls';
import { useI18n } from '@/lib/i18n/I18nContext';
import { SecurityScanModal } from './SecurityScanModal';

export interface SecurityScanButtonProps {
  dataset: Dataset;
  order: number[];
  onOpenDataset: (dataset: Dataset) => void;
}

/** Toolbar entry point for the defensive security scan. */
export function SecurityScanButton({
  dataset,
  order,
  onOpenDataset,
}: SecurityScanButtonProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={order.length === 0}
        aria-label={t('security.scan')}
        className={`${btnSecondary} disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75 11.25 15 15 9.75M21 12c0 4.556-3.04 8.25-7.5 9.286a1.5 1.5 0 0 1-.75 0C8.29 20.25 5.25 16.556 5.25 12V6.75c0-.621.504-1.125 1.125-1.125A7.5 7.5 0 0 0 12 3.75a7.5 7.5 0 0 0 5.625 1.875c.621 0 1.125.504 1.125 1.125V12Z"
          />
        </svg>
        {t('security.scan')}
      </button>
      {open && (
        <SecurityScanModal
          dataset={dataset}
          order={order}
          onOpenDataset={onOpenDataset}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
