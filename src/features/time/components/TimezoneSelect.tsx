import { COMMON_ZONES, LOCAL_TZ } from '@/lib/time/timezone';
import { selectCls } from '@/utils/controls';
import { useI18n } from '@/lib/i18n/I18nContext';

export interface TimezoneSelectProps {
  tz: string;
  onChange: (tz: string) => void;
}

/** Header dropdown for the display timezone (applies to dates + chart buckets). */
export function TimezoneSelect({ tz, onChange }: TimezoneSelectProps) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-1.5">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 text-slate-400 dark:text-slate-500"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.8}
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        />
      </svg>
      <select
        aria-label={t('tz.aria')}
        value={tz}
        onChange={(e) => onChange(e.target.value)}
        className={selectCls}
      >
        {COMMON_ZONES.map((z) => (
          <option key={z.id} value={z.id}>
            {z.id === LOCAL_TZ ? t('tz.local') : z.label}
          </option>
        ))}
      </select>
    </div>
  );
}
