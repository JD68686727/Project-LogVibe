import { formatNumber } from '@/utils/formatNumber';

export interface Bucketer {
  /** Number of buckets spanning the range. */
  count: number;
  /** Bucket index for a value (clamped into range). */
  indexOf: (v: number) => number;
  /** Human label for a bucket, e.g. `0–200`. */
  labelOf: (i: number) => string;
  /** Inclusive-ish [lo, hi) bounds for a bucket, for a drill-down filter. */
  boundsOf: (i: number) => [number, number];
}

/** Rounds a raw step up to a "nice" 1/2/5×10^k value for readable ranges. */
function niceStep(raw: number): number {
  if (!(raw > 0)) return 1;
  const base = 10 ** Math.floor(Math.log10(raw));
  const f = raw / base;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * base;
}

/** Safety cap so a pathological range can't explode the grid. */
const MAX_BUCKETS = 20;

/**
 * Builds evenly-spaced "nice" numeric buckets spanning [min, max], targeting
 * roughly `target` buckets (snapped to 1/2/5×10^k widths). A single distinct
 * value collapses to one exact bucket.
 */
export function makeBucketer(min: number, max: number, target = 12): Bucketer {
  if (!(max > min)) {
    // Single value (or degenerate range) → one exact bucket.
    return {
      count: 1,
      indexOf: () => 0,
      labelOf: () => formatNumber(min),
      boundsOf: () => [min, min],
    };
  }

  const step = niceStep((max - min) / target);
  const niceMin = Math.floor(min / step) * step;
  const count = Math.min(MAX_BUCKETS, Math.floor((max - niceMin) / step) + 1);

  const boundsOf = (i: number): [number, number] => [
    niceMin + i * step,
    niceMin + (i + 1) * step,
  ];

  return {
    count,
    indexOf: (v) => {
      const i = Math.floor((v - niceMin) / step);
      return i < 0 ? 0 : i >= count ? count - 1 : i;
    },
    labelOf: (i) => {
      const [lo, hi] = boundsOf(i);
      return `${formatNumber(lo)}–${formatNumber(hi)}`;
    },
    boundsOf,
  };
}
