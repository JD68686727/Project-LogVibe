import type { ColumnType } from '@/types/dataset';
import type { ColumnDistribution } from '@/types/stats';
import { seriesColor } from '@/utils/chartColors';
import { formatNumber } from '@/utils/formatNumber';
import { formatTimestamp } from '@/lib/time/timezone';

export interface MiniDistributionProps {
  dist: ColumnDistribution;
  /** Column type + timezone so date labels display in the chosen zone. */
  columnType?: ColumnType;
  tz?: string;
}

/** Compact per-column distribution: histogram (numeric) or top-value bar. */
export function MiniDistribution({ dist, columnType, tz }: MiniDistributionProps) {
  const display = (value: string) =>
    columnType === 'date' && tz ? formatTimestamp(value, tz) : value;

  if (dist.kind === 'empty') {
    return <span className="text-xs text-slate-300 dark:text-slate-600">—</span>;
  }

  if (dist.kind === 'numeric') {
    const maxBin = Math.max(...dist.bins, 1);
    return (
      <div
        data-testid="mini-distribution"
        title={`${formatNumber(dist.min)} – ${formatNumber(dist.max)}`}
        className="flex h-8 w-32 items-end gap-px"
      >
        {dist.bins.map((b, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-brand-600 dark:bg-brand-500"
            style={{ height: `${(b / maxBin) * 100}%` }}
          />
        ))}
      </div>
    );
  }

  const { top, othersCount, total } = dist;
  const title =
    top.map((t) => `${display(t.value)}: ${formatNumber(t.count)}`).join('\n') +
    (othersCount > 0 ? `\nothers: ${formatNumber(othersCount)}` : '');

  return (
    <div data-testid="mini-distribution" className="w-40" title={title}>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        {top.map((t, i) => (
          <div
            key={t.value}
            style={{
              width: `${(t.count / total) * 100}%`,
              backgroundColor: seriesColor(i),
            }}
          />
        ))}
        {othersCount > 0 && (
          <div
            className="bg-slate-300 dark:bg-slate-600"
            style={{ width: `${(othersCount / total) * 100}%` }}
          />
        )}
      </div>
      <div className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
        {display(top[0].value)} · {formatNumber(top[0].count)}
      </div>
    </div>
  );
}
