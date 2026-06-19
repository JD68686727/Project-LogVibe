import { useState } from 'react';
import type { Dataset, ColumnType } from '@/types/dataset';
import { cn } from '@/utils/cn';
import { useColumnStats } from '../hooks/useColumnStats';

const TYPE_BADGE: Record<ColumnType, string> = {
  string: 'bg-slate-100 text-slate-600',
  number: 'bg-sky-100 text-sky-700',
  boolean: 'bg-amber-100 text-amber-700',
  date: 'bg-violet-100 text-violet-700',
};

const fmt = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 2 });

export interface StatsPanelProps {
  dataset: Dataset;
  /** Filtered row indices to profile (sorting is irrelevant to stats). */
  order: number[];
}

export function StatsPanel({ dataset, order }: StatsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const stats = useColumnStats(dataset, order, expanded);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
      >
        <span className="text-sm font-semibold text-slate-700">
          Column statistics
        </span>
        <span className="flex items-center gap-2 text-xs text-slate-400">
          {dataset.columns.length} columns · {order.length.toLocaleString()} rows
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
        <div className="max-h-[40vh] overflow-auto border-t border-slate-100">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Column</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-right">Non-null</th>
                <th className="px-3 py-2 text-right">Null</th>
                <th className="px-3 py-2 text-right">Distinct</th>
                <th className="px-3 py-2 text-right">Min</th>
                <th className="px-3 py-2 text-right">Mean</th>
                <th className="px-3 py-2 text-right">Max</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.map((s) => (
                <tr key={s.key} className="hover:bg-brand-50/40">
                  <td className="px-4 py-2 font-medium text-slate-700">{s.name}</td>
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
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600">
                    {fmt(s.count)}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2 text-right font-mono tabular-nums',
                      s.nullCount > 0 ? 'text-rose-500' : 'text-slate-300',
                    )}
                  >
                    {fmt(s.nullCount)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600">
                    {fmt(s.distinctCount)}
                    {s.distinctCapped && '+'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600">
                    {s.numeric ? fmt(s.numeric.min) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600">
                    {s.numeric ? fmt(s.numeric.mean) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600">
                    {s.numeric ? fmt(s.numeric.max) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
