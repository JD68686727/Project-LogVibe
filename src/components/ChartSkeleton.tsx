import { cn } from '@/utils/cn';

export interface ChartSkeletonProps {
  /** Tailwind height (and any extra) classes for the placeholder box. */
  className?: string;
  label?: string;
}

/**
 * Loading placeholder for the lazily-loaded chart bundles. Shows a labelled
 * spinner instead of a blank box, so the brief Recharts chunk fetch reads as
 * "loading" rather than "broken".
 */
export function ChartSkeleton({
  className,
  label = 'Loading chart…',
}: ChartSkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-400',
        className,
      )}
    >
      <svg
        className="h-4 w-4 animate-spin text-brand-500"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      {label}
    </div>
  );
}
