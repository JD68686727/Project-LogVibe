import { useCallback, useState } from 'react';
import { TIMEZONE_STORAGE_KEY, DEFAULT_TZ } from '@/lib/time/timezone';

export interface UseTimezone {
  tz: string;
  setTimezone: (tz: string) => void;
}

/**
 * Owns the app-global display timezone: seeds from localStorage and persists
 * changes. Mirrors `useTheme` — the value is a display lens only, never mutates
 * data. Defaults to UTC so charts/tables are deterministic across machines.
 */
export function useTimezone(): UseTimezone {
  const [tz, setTz] = useState<string>(() => {
    try {
      return localStorage.getItem(TIMEZONE_STORAGE_KEY) ?? DEFAULT_TZ;
    } catch {
      return DEFAULT_TZ;
    }
  });

  const setTimezone = useCallback((next: string) => {
    try {
      localStorage.setItem(TIMEZONE_STORAGE_KEY, next);
    } catch {
      // storage unavailable — keep the in-memory preference
    }
    setTz(next);
  }, []);

  return { tz, setTimezone };
}
