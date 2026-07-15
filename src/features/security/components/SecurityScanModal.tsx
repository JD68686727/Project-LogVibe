import { useState } from 'react';
import type { Dataset } from '@/types/dataset';
import { findingsToDataset } from '@/lib/analysis/findings';
import { findingsToMarkdown } from '@/lib/analysis/report';
import { SECURITY_PROFILES } from '@/lib/security/profiles';
import { makeCellRedactor } from '@/lib/export/redact';
import { downloadBlob } from '@/utils/downloadBlob';
import { btnSecondary } from '@/utils/controls';
import { useI18n } from '@/lib/i18n/I18nContext';
import type { TKey } from '@/lib/i18n/translations';
import { ModalShell } from '@/features/analysis/components/ModalShell';
import { FindingsTable } from '@/features/analysis/components/FindingsTable';
import { useSecurityScan } from '../hooks/useSecurityScan';

const checkbox =
  'h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-700';

export interface SecurityScanModalProps {
  dataset: Dataset;
  /** The current filtered view — the scan runs over exactly what's on screen. */
  order: number[];
  /** Opens the findings as a new workspace dataset (table/filter/export reuse). */
  onOpenDataset: (dataset: Dataset) => void;
  onClose: () => void;
}

function baseName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/** Runs the built-in defensive profiles over the current view and lets the user
 *  open the results as a first-class dataset. 100% local. */
export function SecurityScanModal({
  dataset,
  order,
  onOpenDataset,
  onClose,
}: SecurityScanModalProps) {
  const { t } = useI18n();
  const { findings, scanning } = useSecurityScan(dataset, order);
  const [redactReport, setRedactReport] = useState(false);
  const busy = scanning || findings.length === 0;

  const openAsDataset = () => {
    onOpenDataset(
      findingsToDataset(findings, `${baseName(dataset.meta.fileName)}.threats.csv`),
    );
    onClose();
  };

  const downloadReport = () => {
    const redactor = redactReport
      ? makeCellRedactor(['email', 'mac', 'ipv6', 'ipv4'], 'consistent')
      : null;
    const md = findingsToMarkdown(
      findings,
      { source: dataset.meta.fileName },
      {
        labelFor: (id) => SECURITY_PROFILES.find((p) => p.id === id)?.label ?? id,
        redact: redactor ? (t) => String(redactor(t)) : undefined,
      },
    );
    downloadBlob(
      `${baseName(dataset.meta.fileName)}.security-report.md`,
      md,
      'text/markdown',
    );
  };

  return (
    <ModalShell
      title={t('security.scan')}
      subtitle={t('security.subtitle')}
      testId="security-scan"
      onClose={onClose}
      footer={
        <>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {scanning
                ? t('security.scanning', { n: order.length.toLocaleString() })
                : findings.length > 0
                  ? t('security.summary', {
                      n: findings.length,
                      rows: order.length.toLocaleString(),
                    })
                  : t('security.none')}
            </p>
            {!scanning && findings.length > 0 && (
              <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={redactReport}
                  onChange={(e) => setRedactReport(e.target.checked)}
                  className={checkbox}
                />
                {t('security.redactAddresses')}
              </label>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className={btnSecondary}>
              {t('common.close')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={downloadReport}
              className={`${btnSecondary} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {t('report.download')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={openAsDataset}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('findings.openDataset')}
            </button>
          </div>
        </>
      }
    >
      {/* Per-profile summary */}
      <section className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {t('security.profiles')}
        </p>
        <ul className="space-y-1">
          {SECURITY_PROFILES.map((p) => {
            const n = findings.filter((f) => f.rule === p.id).length;
            return (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-800"
              >
                <span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {t(`security.profile.${p.id}.label` as TKey)}
                  </span>{' '}
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {t(`security.profile.${p.id}.hint` as TKey)}
                  </span>
                </span>
                <span
                  className={
                    n > 0
                      ? 'rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                      : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }
                >
                  {n}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Findings */}
      {scanning ? (
        <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500 dark:border-slate-600 dark:border-t-brand-400" />
          {t('security.scanningThread')}
        </p>
      ) : findings.length > 0 ? (
        <section className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {t('findings.heading')}
          </p>
          <FindingsTable findings={findings} />
        </section>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
          {t('security.nothing')}
        </p>
      )}
    </ModalShell>
  );
}
