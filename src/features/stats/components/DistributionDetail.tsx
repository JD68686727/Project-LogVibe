import type { ColumnType } from '@/types/dataset';
import type { ColumnDistribution } from '@/types/stats';
import { seriesColor } from '@/utils/chartColors';
import { formatNumber } from '@/utils/formatNumber';
import { formatTimestamp } from '@/lib/time/timezone';
import { useI18n } from '@/lib/i18n/I18nContext';
import {
  binBounds,
  categoricalFilter,
  numericBinFilter,
  type NewFilter,
} from '@/lib/stats/distributionFilter';

export interface DistributionDetailColumn {
  key: string;
  name: string;
  type: ColumnType;
}

export interface DistributionDetailProps {
  column: DistributionDetailColumn;
  dist: ColumnDistribution;
  /** Called with a ready-to-add filter when a bin or value is clicked. */
  onPick: (filter: NewFilter) => void;
  /** Display timezone; date values are shown in it (the filter stays raw). */
  tz?: string;
}

const heading = 'mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400';
const hint = 'mt-2 text-[11px] text-slate-400 dark:text-slate-500';

/** The larger, labeled distribution shown in a popover; click to drill in. */
export function DistributionDetail({
  column,
  dist,
  onPick,
  tz,
}: DistributionDetailProps) {
  const { t } = useI18n();
  const display = (value: string) =>
    column.type === 'date' && tz ? formatTimestamp(value, tz) : value;

  if (dist.kind === 'empty') {
    return (
      <p className="w-48 text-sm text-slate-400 dark:text-slate-500">
        {t('dist.empty', { name: column.name })}
      </p>
    );
  }

  if (dist.kind === 'numeric') {
    const maxBin = Math.max(...dist.bins, 1);
    return (
      <div data-testid="distribution-detail" className="w-72">
        <p className={heading}>{t('dist.numericTitle', { name: column.name })}</p>
        <div className="flex h-28 items-end gap-1">
          {dist.bins.map((count, i) => {
            const { lo, hi } = binBounds(dist, i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => onPick(numericBinFilter(column.key, dist, i))}
                title={`${formatNumber(lo)} – ${formatNumber(hi)}: ${formatNumber(count)}`}
                aria-label={t('dist.filterRange', {
                  name: column.name,
                  lo: formatNumber(lo),
                  hi: formatNumber(hi),
                })}
                className="group flex h-full flex-1 items-end"
              >
                <span
                  className="w-full rounded-sm bg-brand-500 transition-colors group-hover:bg-brand-700 dark:bg-brand-500 dark:group-hover:bg-brand-300"
                  style={{ height: `${(count / maxBin) * 100}%` }}
                />
              </button>
            );
          })}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
          <span>{formatNumber(dist.min)}</span>
          <span>{formatNumber(dist.max)}</span>
        </div>
        <p className={hint}>{t('dist.hintRange')}</p>
      </div>
    );
  }

  const { top, othersCount } = dist;
  return (
    <div data-testid="distribution-detail" className="w-72">
      <p className={heading}>{t('dist.topTitle', { name: column.name })}</p>
      <ul className="space-y-0.5">
        {top.map((tv, i) => (
          <li key={tv.value}>
            <button
              type="button"
              onClick={() => onPick(categoricalFilter(column.key, column.type, tv.value))}
              aria-label={t('dist.filterEq', { name: column.name, value: display(tv.value) })}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: seriesColor(i) }}
              />
              <span className="flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                {display(tv.value)}
              </span>
              <span className="font-mono text-xs tabular-nums text-slate-400 dark:text-slate-500">
                {formatNumber(tv.count)}
              </span>
            </button>
          </li>
        ))}
        {othersCount > 0 && (
          <li className="flex items-center gap-2 px-2 py-1 text-sm text-slate-400 dark:text-slate-500">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-slate-300 dark:bg-slate-600" />
            <span className="flex-1 truncate">{t('dist.others')}</span>
            <span className="font-mono text-xs tabular-nums">
              {formatNumber(othersCount)}
            </span>
          </li>
        )}
      </ul>
      <p className={hint}>{t('dist.hintValue')}</p>
    </div>
  );
}
