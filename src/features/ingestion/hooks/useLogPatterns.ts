import { useCallback, useState } from 'react';
import type { LogPattern, SavedLogPattern } from '@/types/logPattern';
import {
  deletePattern,
  getPatterns,
  savePattern,
} from '@/lib/log/logPatternStore';

let idCounter = 0;
const nextId = () => `pattern-${Date.now()}-${++idCounter}`;

export interface UseLogPatterns {
  patterns: SavedLogPattern[];
  save: (name: string, pattern: LogPattern) => void;
  remove: (id: string) => void;
}

/** Manages the list of saved custom-log patterns (LocalStorage-backed). */
export function useLogPatterns(): UseLogPatterns {
  const [patterns, setPatterns] = useState<SavedLogPattern[]>(() => getPatterns());

  const save = useCallback((name: string, pattern: LogPattern) => {
    setPatterns(
      savePattern({
        id: nextId(),
        name: name.trim(),
        regex: pattern.regex,
        flags: pattern.flags,
        createdAt: Date.now(),
      }),
    );
  }, []);

  const remove = useCallback((id: string) => {
    setPatterns(deletePattern(id));
  }, []);

  return { patterns, save, remove };
}
