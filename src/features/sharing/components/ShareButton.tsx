import { useCallback, useState } from 'react';
import type { ViewState } from '@/types/share';
import { encodeView } from '@/lib/share/encodeView';
import { cn } from '@/utils/cn';
import { useI18n } from '@/lib/i18n/I18nContext';

export interface ShareButtonProps {
  /** Builds the current view on demand (only when the button is clicked). */
  getView: () => ViewState;
}

export function ShareButton({ getView }: ShareButtonProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const token = encodeView(getView());
    const url = `${window.location.origin}${window.location.pathname}#v=${token}`;
    // Reflect the shareable state in the address bar so it's copyable even if
    // the Clipboard API is unavailable.
    window.history.replaceState(null, '', `#v=${token}`);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard blocked — the URL is in the address bar to copy manually.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }, [getView]);

  return (
    <button
      type="button"
      onClick={handleShare}
      title={t('share.note')}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
        copied
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300'
          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
      )}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 text-slate-400 dark:text-slate-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
      </svg>
      {copied ? t('share.copied') : t('share.view')}
    </button>
  );
}
