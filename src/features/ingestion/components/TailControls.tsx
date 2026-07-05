import { cn } from '@/utils/cn';

const btn =
  'rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-emerald-500/20';

export interface TailControlsProps {
  fileName: string;
  paused: boolean;
  atCap: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

/** Live-tail status strip: pulsing indicator + pause/resume/stop. */
export function TailControls({
  fileName,
  paused,
  atCap,
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
      {atCap && (
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
          row cap reached — no longer appending
        </span>
      )}
      <div className="ml-auto flex items-center gap-2">
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
