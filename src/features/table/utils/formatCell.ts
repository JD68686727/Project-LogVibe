import type { CellValue, ColumnType } from '@/types/dataset';
import { formatNumber } from '@/utils/formatNumber';
import { formatTimestamp, DEFAULT_TZ } from '@/lib/time/timezone';

export interface FormattedCell {
  text: string;
  align: 'left' | 'right';
  /** True for empty/null cells so the UI can render them dimmed. */
  muted: boolean;
}

/**
 * Pure display formatting for a single cell. Kept out of the component so it can
 * be unit-tested and reused (e.g. CSV re-export, chart tooltips). `tz` is the
 * display timezone applied to date columns (raw string stays the source of truth).
 */
export function formatCell(
  value: CellValue,
  type: ColumnType,
  tz: string = DEFAULT_TZ,
): FormattedCell {
  if (value == null) return { text: '—', align: 'left', muted: true };

  switch (type) {
    case 'number':
      return {
        text: typeof value === 'number' ? formatNumber(value) : String(value),
        align: 'right',
        muted: false,
      };
    case 'boolean':
      return { text: value ? 'true' : 'false', align: 'left', muted: false };
    case 'date':
      return { text: formatTimestamp(String(value), tz), align: 'left', muted: false };
    default:
      return { text: String(value), align: 'left', muted: false };
  }
}
