/**
 * All of LogVibe's remembered settings live under this localStorage prefix:
 * column type overrides, computed columns, saved views, last view, theme,
 * timezone, alert prefs. Row data is never stored — only configuration.
 */
const PREFIX = 'logvibe.';

/** How many preference keys are currently stored (for the settings summary). */
export function savedPreferenceCount(): number {
  try {
    return Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).length;
  } catch {
    return 0;
  }
}

/** Removes every remembered preference; returns how many keys were cleared. */
export function clearSavedPreferences(): number {
  let cleared = 0;
  try {
    for (const key of Object.keys(localStorage).filter((k) => k.startsWith(PREFIX))) {
      localStorage.removeItem(key);
      cleared += 1;
    }
  } catch {
    // storage unavailable — nothing to clear
  }
  return cleared;
}
