const STORAGE_KEY = 'logvibe.tailKeepLast';

/** Preset ring-buffer windows offered in Settings. 0 = unlimited (hard cap only). */
export const TAIL_BUFFER_OPTIONS = [0, 50_000, 100_000, 200_000] as const;

/**
 * The live-tail ring-buffer window (keep-last-N rows), or `null` for unlimited.
 * A long-running tail with a window stays memory-bounded by evicting old rows.
 */
export function getTailKeepLast(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Persists the window; 0 (or non-positive) means unlimited. */
export function setTailKeepLast(n: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(n > 0 ? n : 0));
  } catch {
    // storage unavailable — ignore
  }
}
