import { cn } from '@/utils/cn';

const btn =
  'rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-emerald-500/20';

export interface TailControlsProps {
  fileName: string;
  paused: boolean;
  atCap: boolean;
  /** Live threat-scan finding count (0 hides the badge). */
  findingCount?: number;
  /** Whether desktop alerts on new high-severity findings are enabled. */
  alertsOn?: boolean;
  /** Toggles alerts (undefined hides the bell). */
  onToggleAlerts?: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

/** Live-tail status strip: pulsing indicator + pause/resume/stop. */
export function TailControls({
  fileName,
  paused,
  atCap,
  findingCount = 0,
  alertsOn = false,
  onToggleAlerts,
  onPause,
  onResume,
  onStop,
}: TailControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
      <span className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300">
        <span
          className={cn(
            'h-2 w-2 rounded-full bg-emerald-500',
            !paused && 'animate-pulse',
          )}
        />
        {paused ? 'Paused' : 'Live'}
      </span>
      <span className="text-emerald-700/80 dark:text-emerald-300/80">
        tailing <span className="font-mono">{fileName}</span>
      </span>
      {findingCount > 0 && (
        <span
          className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
          title="Open Security scan for details"
        >
          ⚠ {findingCount} finding{findingCount === 1 ? '' : 's'}
        </span>
      )}
      {atCap && (
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
          row cap reached — no longer appending
        </span>
      )}
      <div className="ml-auto flex items-center gap-2">
        {onToggleAlerts && (
          <button
            type="button"
            onClick={onToggleAlerts}
            aria-pressed={alertsOn}
            aria-label="Alert on high-severity findings"
            title="Desktop alert on new high-severity findings"
            className={cn(
              btn,
              alertsOn && 'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-white',
            )}
          >
            {alertsOn ? '🔔 Alerts on' : '🔕 Alert me'}
          </button>
        )}
        {paused ? (
          <button type="button" onClick={onResume} className={btn}>
            Resume
          </button>
        ) : (
          <button type="button" onClick={onPause} className={btn}>
            Pause
          </button>
        )}
        <button type="button" onClick={onStop} className={btn}>
          Stop
        </button>
      </div>
    </div>
  );
}
