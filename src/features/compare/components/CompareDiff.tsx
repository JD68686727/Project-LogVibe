import { useMemo, useState } from 'react';
import type { CellValue, Dataset } from '@/types/dataset';
import { cn } from '@/utils/cn';
import { selectCls } from '@/utils/controls';
import { formatNumber as fmt } from '@/utils/formatNumber';
import { commonColumns } from '@/lib/compare/commonColumns';
import { diffSchema } from '@/lib/compare/schemaDiff';
import { diffRows } from '@/lib/compare/rowDiff';
import { useI18n } from '@/lib/i18n/I18nContext';

export interface CompareDiffProps {
  /** Baseline file (A). */
  a: Dataset;
  /** Comparison file (B). */
  b: Dataset;
}

const chip = 'rounded-full px-2 py-0.5 text-xs font-semibold';
const added = `${chip} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`;
const removed = `${chip} bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300`;
const changed = `${chip} bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300`;
const same = `${chip} bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300`;
const heading = 'text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500';

const cell = (v: CellValue): string => (v == null || v === '' ? '∅' : String(v));

export function CompareDiff({ a, b }: CompareDiffProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const common = useMemo(() => commonColumns([a, b]), [a, b]);
  const [keyKey, setKeyKey] = useState(() => common[0]?.key ?? '');

  const schema = useMemo(
    () => (expanded ? diffSchema(a, b) : null),
    [expanded, a, b],
  );
  const rows = useMemo(
    () => (expanded && keyKey ? diffRows(a, b, keyKey) : null),
    [expanded, a, b, keyKey],
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {t('compare.diff')}
        </span>
        <span className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
          <span className="max-w-[40vw] truncate">
            {a.meta.fileName} → {b.meta.fileName}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {expanded && schema && (
        <div
          data-testid="compare-diff"
          className="space-y-4 border-t border-slate-100 px-4 py-3 dark:border-slate-800"
        >
          {/* Schema diff */}
          <section className="space-y-2">
            <p className={heading}>{t('compare.schema')}</p>
            {schema.added.length === 0 &&
            schema.removed.length === 0 &&
            schema.typeChanged.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('compare.identicalSchema', { n: fmt(schema.unchanged.length) })}
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                {schema.added.map((c) => (
                  <span key={c.key} className={added}>
                    + {c.name}
                  </span>
                ))}
                {schema.removed.map((c) => (
                  <span key={c.key} className={removed}>
                    − {c.name}
                  </span>
                ))}
                {schema.typeChanged.map((c) => (
                  <span key={c.key} className={changed}>
                    ~ {c.name} ({c.from} → {c.to})
                  </span>
                ))}
                <span className={same}>
                  {t('compare.schemaUnchanged', { n: fmt(schema.unchanged.length) })}
                </span>
              </div>
            )}
          </section>

          {/* Row diff */}
          <section className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className={heading}>{t('compare.rowsHeading')}</p>
              <label className="ml-auto text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('compare.matchBy')}
              </label>
              <select
                aria-label={t('compare.keyColumn')}
                value={keyKey}
                onChange={(e) => setKeyKey(e.target.value)}
                className={selectCls}
              >
                {common.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {!rows ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">
                {t('compare.noMatchKey')}
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={added}>{t('compare.rowsAdded', { n: fmt(rows.added) })}</span>
                  <span className={removed}>{t('compare.rowsRemoved', { n: fmt(rows.removed) })}</span>
                  <span className={changed}>{t('compare.rowsChanged', { n: fmt(rows.changed) })}</span>
                  <span className={same}>{t('compare.rowsUnchanged', { n: fmt(rows.unchanged) })}</span>
                </div>

                {rows.duplicateKeys && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {t('compare.dupKeys', { name: rows.keyName })}
                  </p>
                )}

                {rows.changedSample.length > 0 && (
                  <ul className="space-y-1 text-sm">
                    {rows.changedSample.slice(0, 8).map((r) => (
                      <li
                        key={r.key}
                        className="rounded-md bg-slate-50 px-2 py-1 dark:bg-slate-800/60"
                      >
                        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                          {r.key}
                        </span>
                        <span className="ml-2 text-slate-600 dark:text-slate-300">
                          {r.changes
                            .map((c) => `${c.name}: ${cell(c.from)} → ${cell(c.to)}`)
                            .join(' · ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
