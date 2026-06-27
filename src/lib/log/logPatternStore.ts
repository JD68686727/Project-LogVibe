import type { SavedLogPattern } from '@/types/logPattern';

const STORAGE_KEY = 'logvibe.logpatterns.v1';

function readAll(): SavedLogPattern[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedLogPattern[]) : [];
  } catch {
    // Corrupt JSON or storage disabled — degrade to "no saved patterns".
    return [];
  }
}

function writeAll(patterns: SavedLogPattern[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns));
  } catch {
    // Quota exceeded / private mode — fail silently; the builder still works.
  }
}

/** All saved log patterns, newest first. */
export function getPatterns(): SavedLogPattern[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt);
}

export function savePattern(pattern: SavedLogPattern): SavedLogPattern[] {
  const all = readAll().filter((p) => p.id !== pattern.id);
  all.push(pattern);
  writeAll(all);
  return getPatterns();
}

export function deletePattern(id: string): SavedLogPattern[] {
  writeAll(readAll().filter((p) => p.id !== id));
  return getPatterns();
}
