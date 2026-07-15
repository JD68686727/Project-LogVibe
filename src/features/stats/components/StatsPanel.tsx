import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Dataset, ColumnType } from '@/types/dataset';
import type { ColumnFilter } from '@/types/filter';
import { cn } from '@/utils/cn';
import { formatNumber as fmt } from '@/utils/formatNumber';
import { useI18n } from '@/lib/i18n/I18nContext';
import { computeColumnDistributions } from '@/lib/stats/distribution';
import { Popover } from '@/components/Popover';
import { useColumnStats } from '../hooks/useColumnStats';
import { MiniDistribution } from './MiniDistribution';
import { DistributionDetail } from './DistributionDetail';

const TYPE_BADGE: Record<ColumnType, string> = {
  string: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  number: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
  boolean: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  date: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
};

export interface StatsPanelProps {
  dataset: Dataset;
  /** Filtered row indices to profile (sorting is irrelevant to stats). */
  order: number[];
  /** When provided, distributions become clickable to drill into a filter. */
  onAddFilter?: (filter: Omit<ColumnFilter, 'id'>) => void;
  /** Display timezone for date distribution labels. */
  timeZone?: string;
}

const numCell = 'px-3 py-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300';

export function StatsPanel({ dataset, order, onAddFilter, timeZone }: StatsPanelProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState<{ key: string; anchor: HTMLElement } | null>(
    null,
  );
  const stats = useColumnStats(dataset, order, expanded);
  const distributions = useMemo(
    () => (expanded ? computeColumnDistributions(dataset, order) : null),
    [expanded, dataset, order],
  );

  let popover: ReactNode = null;
  if (open && stats && distributions && onAddFilter) {
    const idx = stats.findIndex((s) => s.key === open.key);
    if (idx >= 0) {
      const col = stats[idx];
      popover = (
        <Popover anchor={open.anchor} onClose={() => setOpen(null)}>
          <DistributionDetail
            column={{ key: col.key, name: col.name, type: col.type }}
            dist={distributions[idx]}
            tz={timeZone}
            onPick={(filter) => {
              onAddFilter(filter);
              setOpen(null);
            }}
          />
        </Popover>
      );
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => {
          setExpanded((e) => !e);
          setOpen(null);
        }}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {t('stats.title')}
        </span>
        <span className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
          {t('stats.summary', {
            cols: dataset.columns.length,
            rows: order.length.toLocaleString(),
          })}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={cn(
              'h-4 w-4 transition-transform',
              expanded && 'rotate-180',
            )}
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

      {expanded && stats && (
        <div className="max-h-[40vh] overflow-auto border-t border-slate-100 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2 text-left">{t('stats.col.column')}</th>
                <th className="px-3 py-2 text-left">{t('stats.col.type')}</th>
                <th className="px-3 py-2 text-right">{t('stats.col.nonNull')}</th>
                <th className="px-3 py-2 text-right">{t('stats.col.null')}</th>
                <th className="px-3 py-2 text-right">{t('stats.col.distinct')}</th>
                <th className="px-3 py-2 text-right">{t('stats.col.min')}</th>
                <th className="px-3 py-2 text-right">{t('stats.col.mean')}</th>
                <th className="px-3 py-2 text-right">{t('stats.col.max')}</th>
                <th className="px-3 py-2 text-left">{t('stats.col.distribution')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {stats.map((s, i) => (
                <tr key={s.key} className="hover:bg-brand-50/40 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-200">
                    {s.name}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-xs font-medium',
                        TYPE_BADGE[s.type],
                      )}
                    >
                      {s.type}
                    </span>
                  </td>
                  <td className={numCell}>{fmt(s.count)}</td>
                  <td
                    className={cn(
                      'px-3 py-2 text-right font-mono tabular-nums',
                      s.nullCount > 0
                        ? 'text-rose-500 dark:text-rose-400'
                        : 'text-slate-300 dark:text-slate-600',
                    )}
                  >
                    {fmt(s.nullCount)}
                  </td>
                  <td className={numCell}>
                    {fmt(s.distinctCount)}
                    {s.distinctCapped && '+'}
                  </td>
                  <td className={numCell}>{s.numeric ? fmt(s.numeric.min) : '—'}</td>
                  <td className={numCell}>{s.numeric ? fmt(s.numeric.mean) : '—'}</td>
                  <td className={numCell}>{s.numeric ? fmt(s.numeric.max) : '—'}</td>
                  <td className="px-3 py-2">
                    {distributions &&
                      (distributions[i].kind === 'empty' || !onAddFilter ? (
                        <MiniDistribution
                          dist={distributions[i]}
                          columnType={s.type}
                          tz={timeZone}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={(e) =>
                            setOpen((o) =>
                              o?.key === s.key
                                ? null
                                : { key: s.key, anchor: e.currentTarget },
                            )
                          }
                          aria-label={t('stats.showDist', { name: s.name })}
                          aria-expanded={open?.key === s.key}
                          className="rounded transition hover:ring-2 hover:ring-brand-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        >
                          <MiniDistribution
                            dist={distributions[i]}
                            columnType={s.type}
                            tz={timeZone}
                          />
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {popover}
    </div>
  );
}
