import { useRef, useState } from 'react';
import type { Dataset } from '@/types/dataset';
import { findingsToDataset } from '@/lib/analysis/findings';
import { findingsToMarkdown } from '@/lib/analysis/report';
import { auditConfigText, type ConfigAuditResult } from '@/lib/config/audit';
import { ruleTitle } from '@/lib/config/rules';
import { readFileSmart } from '@/lib/csv/encoding';
import { downloadBlob } from '@/utils/downloadBlob';
import { btnSecondary } from '@/utils/controls';
import { useI18n } from '@/lib/i18n/I18nContext';
import { ModalShell } from '@/features/analysis/components/ModalShell';
import { FindingsTable } from '@/features/analysis/components/FindingsTable';

export interface ConfigAuditModalProps {
  onFindings: (dataset: Dataset) => void;
  onClose: () => void;
}

function baseName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/** Loads a server config file, checks it against local hardening rules, and
 *  surfaces findings — 100% in the browser, no upload. */
export function ConfigAuditModal({ onFindings, onClose }: ConfigAuditModalProps) {
  const { t } = useI18n();
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ConfigAuditResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const { text } = await readFileSmart(file);
      setFileName(file.name);
      setResult(auditConfigText(file.name, text));
    } catch {
      setError(t('config.readError'));
    } finally {
      setBusy(false);
    }
  };

  const openAsDataset = () => {
    if (!result || !fileName) return;
    onFindings(
      findingsToDataset(result.findings, `${baseName(fileName)}.audit.csv`),
    );
    onClose();
  };

  const downloadReport = () => {
    if (!result || !fileName) return;
    const md = findingsToMarkdown(
      result.findings,
      { source: fileName },
      { labelFor: (id) => ruleTitle(id) ?? id },
    );
    downloadBlob(`${baseName(fileName)}.security-report.md`, md, 'text/markdown');
  };

  const issues = result?.findings.length ?? 0;

  return (
    <ModalShell
      title={t('config.title')}
      subtitle={t('config.subtitle')}
      testId="config-audit"
      onClose={onClose}
      footer={
        <>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {result
              ? t('config.footer', {
                  syntax: result.syntax.toUpperCase(),
                  n: result.entryCount,
                  issues,
                })
              : t('config.footerStart')}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className={btnSecondary}>
              {t('common.close')}
            </button>
            <button
              type="button"
              disabled={issues === 0}
              onClick={downloadReport}
              className={`${btnSecondary} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {t('report.download')}
            </button>
            <button
              type="button"
              disabled={issues === 0}
              onClick={openAsDataset}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('findings.openDataset')}
            </button>
          </div>
        </>
      }
    >
      <section className="space-y-1.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={btnSecondary}
          >
            {busy ? t('config.reading') : t('config.load')}
          </button>
          {fileName && (
            <span className="truncate text-xs text-slate-500 dark:text-slate-400">
              {fileName}
            </span>
          )}
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void load(f);
              e.target.value = '';
            }}
          />
        </div>
        {error && (
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
      </section>

      {result &&
        (issues > 0 ? (
          <section className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {t('findings.heading')}
            </p>
            <FindingsTable findings={result.findings} />
          </section>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
            {result.entryCount === 0
              ? t('config.noDirectives')
              : t('config.noIssues', { n: result.entryCount })}
          </p>
        ))}
    </ModalShell>
  );
}
