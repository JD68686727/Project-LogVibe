import { useState } from 'react';
import type { Theme } from '@/types/theme';
import { LANGUAGES } from '@/types/i18n';
import { btnSecondary } from '@/utils/controls';
import { formatInt } from '@/utils/formatNumber';
import { useI18n } from '@/lib/i18n/I18nContext';
import { ModalShell } from '@/features/analysis/components/ModalShell';
import { ThemeToggle } from '@/features/theme/components/ThemeToggle';
import { TimezoneSelect } from '@/features/time/components/TimezoneSelect';
import {
  clearSavedPreferences,
  savedPreferenceCount,
} from '@/lib/storage/clearPreferences';
import {
  getTailKeepLast,
  setTailKeepLast,
  TAIL_BUFFER_OPTIONS,
} from '@/lib/storage/tailBufferStore';

export interface SettingsPanelProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  tz: string;
  onTimezoneChange: (tz: string) => void;
  /** Default: notify on high-severity findings while live-tailing. */
  alertsOn: boolean;
  onToggleAlerts: () => void;
  onClose: () => void;
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/**
 * Central home for app defaults (theme, display timezone, live-tail alerting)
 * plus local-data management — the one place to see and wipe everything LogVibe
 * remembers in this browser. Reuses the same stateless controls as the header,
 * so both stay in sync.
 */
export function SettingsPanel({
  theme,
  onThemeChange,
  tz,
  onTimezoneChange,
  alertsOn,
  onToggleAlerts,
  onClose,
}: SettingsPanelProps) {
  const { t, lang, setLang } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [keepLast, setKeepLast] = useState(() => getTailKeepLast() ?? 0);
  // Read live each render so it reflects prefs written while the panel is open.
  const count = savedPreferenceCount();

  const changeKeepLast = (n: number) => {
    setTailKeepLast(n);
    setKeepLast(n);
  };

  const handleClear = () => {
    clearSavedPreferences();
    setConfirming(false);
    // Reload so in-memory state (theme/tz/views) resets to defaults cleanly.
    window.location.reload();
  };

  return (
    <ModalShell
      title={t('settings.title')}
      testId="settings-panel"
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className={`${btnSecondary} ml-auto`}>
          {t('common.close')}
        </button>
      }
    >
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        <Row label={t('settings.appearance')} hint={t('settings.appearance.hint')}>
          <ThemeToggle theme={theme} onChange={onThemeChange} />
        </Row>
        <Row label={t('settings.language')} hint={t('settings.language.hint')}>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as typeof lang)}
            aria-label={t('settings.language')}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-600 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </Row>
        <Row label={t('settings.timezone')} hint={t('settings.timezone.hint')}>
          <TimezoneSelect tz={tz} onChange={onTimezoneChange} />
        </Row>
        <Row label={t('settings.alerts')} hint={t('settings.alerts.hint')}>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={alertsOn}
              onChange={onToggleAlerts}
              aria-label={t('settings.alerts.hint')}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-700"
            />
            {alertsOn ? t('settings.on') : t('settings.off')}
          </label>
        </Row>
        <Row label={t('settings.tailBuffer')} hint={t('settings.tailBuffer.hint')}>
          <select
            value={keepLast}
            onChange={(e) => changeKeepLast(Number(e.target.value))}
            aria-label={t('settings.tailBuffer')}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-600 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            {TAIL_BUFFER_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n === 0
                  ? t('settings.tailBuffer.unlimited')
                  : t('settings.tailBuffer.last', { n: formatInt(n) })}
              </option>
            ))}
          </select>
        </Row>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {t('settings.saved.title')}
        </p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {t('settings.saved.body', { count })}
        </p>
        <div className="mt-2">
          {confirming ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 dark:text-slate-300">
                {t('settings.saved.confirm')}
              </span>
              <button
                type="button"
                onClick={handleClear}
                className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
              >
                {t('settings.saved.confirmClear')}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                {t('settings.saved.cancel')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={count === 0}
              className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              {t('settings.saved.clear')}
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
