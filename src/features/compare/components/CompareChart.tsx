import type { ReactElement } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CompareChartType, CompareSeriesRow } from '@/types/compare';
import { seriesColor } from '@/utils/chartColors';
import { formatNumber } from '@/utils/formatNumber';
import { useI18n } from '@/lib/i18n/I18nContext';

// Theme-aware via CSS variables (see index.css).
const AXIS_TICK = { fontSize: 11, fill: 'var(--chart-axis)' };
const GRID = 'var(--chart-grid)';
const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'var(--chart-tooltip-bg)',
    border: '1px solid var(--chart-tooltip-border)',
    borderRadius: 8,
    color: 'var(--chart-tooltip-text)',
  },
  labelStyle: { color: 'var(--chart-tooltip-text)' },
  itemStyle: { color: 'var(--chart-tooltip-text)' },
};

function formatTooltip(value: unknown): string {
  return formatNumber(typeof value === 'number' ? value : Number(value));
}

export interface CompareChartProps {
  type: CompareChartType;
  data: CompareSeriesRow[];
  /** One series (file) per label; rendered in this order. */
  seriesLabels: string[];
}

function renderChart(
  type: CompareChartType,
  data: CompareSeriesRow[],
  seriesLabels: string[],
): ReactElement {
  if (type === 'line') {
    return (
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey="name" tick={AXIS_TICK} interval="preserveStartEnd" />
        <YAxis tick={AXIS_TICK} width={48} />
        <Tooltip formatter={(value) => formatTooltip(value)} {...tooltipStyle} />
        <Legend />
        {seriesLabels.map((label, i) => (
          <Line
            key={label}
            type="monotone"
            dataKey={label}
            stroke={seriesColor(i)}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    );
  }

  return (
    <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
      <XAxis dataKey="name" tick={AXIS_TICK} interval="preserveStartEnd" />
      <YAxis tick={AXIS_TICK} width={48} />
      <Tooltip formatter={(value) => formatTooltip(value)} />
      <Legend />
      {seriesLabels.map((label, i) => (
        <Bar key={label} dataKey={label} fill={seriesColor(i)} radius={[3, 3, 0, 0]} />
      ))}
    </BarChart>
  );
}

export function CompareChart({ type, data, seriesLabels }: CompareChartProps) {
  const { t } = useI18n();
  if (data.length === 0 || seriesLabels.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
        {t('compare.nothing')}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      {renderChart(type, data, seriesLabels)}
    </ResponsiveContainer>
  );
}
