import { useCallback, useEffect, useRef, useState } from 'react';
import type { ColumnSchema, Dataset } from '@/types/dataset';
import { datasetToCsv } from '@/lib/csv/exportCsv';
import { datasetToJson } from '@/lib/export/exportJson';
import {
  REDACTABLE,
  makeCellRedactor,
  type RedactionMode,
} from '@/lib/export/redact';
import { downloadBlob } from '@/utils/downloadBlob';
import { btnSecondary } from '@/utils/controls';
import { formatInt } from '@/utils/formatNumber';
import { useI18n } from '@/lib/i18n/I18nContext';

/** `server-logs.csv` → `server-logs.filtered[.redacted].<ext>` */
function exportName(fileName: string, ext: string, redacted: boolean): string {
  const dot = fileName.lastIndexOf('.');
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  return `${base}.filtered${redacted ? '.redacted' : ''}.${ext}`;
}

export interface ExportMenuProps {
  dataset: Dataset;
  /** Filtered + sorted row indices — export mirrors the on-screen view. */
  order: number[];
  /** Visible columns (ordered) — export mirrors the visible table. */
  columns: ColumnSchema[];
  /** Current display timezone; enables the "dates in zone" export option. */
  timeZone?: string;
}

const item =
  'flex w-full items-center justify-between gap-6 rounded-md px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800';
const ext = 'font-mono text-xs text-slate-400 dark:text-slate-500';
const checkbox =
  'h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-700';

export function ExportMenu({ dataset, order, columns, timeZone }: ExportMenuProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [redact, setRedact] = useState(false);
  const [cats, setCats] = useState<string[]>(() => REDACTABLE.map((r) => r.id));
  const [mode, setMode] = useState<RedactionMode>('consistent');
  const [datesInZone, setDatesInZone] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const hasDate = columns.some((c) => c.type === 'date');

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const name = dataset.meta.fileName;
  const redacting = redact && cats.length > 0;
  const exportTz = datesInZone && hasDate ? timeZone : undefined;

  const toggleCat = (id: string) =>
    setCats((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );

  // A fresh redactor per export keeps consistent-dummy numbering per file.
  const exportCsv = useCallback(() => {
    const r = redacting ? makeCellRedactor(cats, mode) : undefined;
    downloadBlob(
      exportName(name, 'csv', redacting),
      datasetToCsv(dataset, order, columns, r, exportTz),
    );
    setOpen(false);
  }, [dataset, order, columns, name, redacting, cats, mode, exportTz]);

  const exportJson = useCallback(() => {
    const r = redacting ? makeCellRedactor(cats, mode) : undefined;
    downloadBlob(
      exportName(name, 'json', redacting),
      datasetToJson(dataset, order, columns, r, exportTz),
      'application/json',
    );
    setOpen(false);
  }, [dataset, order, columns, name, redacting, cats, mode, exportTz]);

  const exportXlsx = useCallback(async () => {
    setBusy(true);
    try {
      const r = redacting ? makeCellRedactor(cats, mode) : undefined;
      // Lazy: SheetJS is fetched only on first Excel export.
      const { datasetToXlsxBlob } = await import('@/lib/export/exportXlsx');
      downloadBlob(
        exportName(name, 'xlsx', redacting),
        await datasetToXlsxBlob(dataset, order, columns, r, exportTz),
      );
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }, [dataset, order, columns, name, redacting, cats, mode, exportTz]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={order.length === 0}
        aria-expanded={open}
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
            d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
          />
        </svg>
        {t('export.button', { n: formatInt(order.length) })}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={redact}
                onChange={(e) => setRedact(e.target.checked)}
                className={checkbox}
              />
              {t('export.redact')}
            </label>
            {redact && (
              <div className="mt-2 space-y-2 pl-6">
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {REDACTABLE.map((r) => (
                    <label
                      key={r.id}
                      className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={cats.includes(r.id)}
                        onChange={() => toggleCat(r.id)}
                        className={checkbox}
                      />
                      {t(r.label)}
                    </label>
                  ))}
                </div>
                <div className="flex gap-3 text-xs text-slate-600 dark:text-slate-300">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="redact-mode"
                      checked={mode === 'consistent'}
                      onChange={() => setMode('consistent')}
                      className="text-brand-600 focus:ring-brand-500/30"
                    />
                    {t('export.consistent')}
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="redact-mode"
                      checked={mode === 'token'}
                      onChange={() => setMode('token')}
                      className="text-brand-600 focus:ring-brand-500/30"
                    />
                    [REDACTED]
                  </label>
                </div>
              </div>
            )}
          </div>

          {hasDate && timeZone && (
            <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={datesInZone}
                  onChange={(e) => setDatesInZone(e.target.checked)}
                  className={checkbox}
                />
                {t('export.datesIn')}{' '}
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {timeZone}
                </span>
              </label>
            </div>
          )}
          <button type="button" onClick={exportCsv} aria-label="CSV" className={item}>
            CSV<span className={ext}>.csv</span>
          </button>
          <button type="button" onClick={exportJson} aria-label="JSON" className={item}>
            JSON<span className={ext}>.json</span>
          </button>
          <button
            type="button"
            onClick={exportXlsx}
            disabled={busy}
            aria-label="Excel"
            className={item}
          >
            Excel<span className={ext}>{busy ? '…' : '.xlsx'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
