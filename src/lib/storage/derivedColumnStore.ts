import type { Dataset } from '@/types/dataset';
import type { DerivedSpec } from '@/lib/table/deriveColumn';

const STORAGE_KEY = 'logvibe.derived.v1';
const MAX_SIGNATURES = 20;

/**
 * A signature over the BASE column keys only — computed columns (`derived`) are
 * excluded so it stays stable as they are added/removed, and so a re-opened
 * file with the same source structure matches its remembered specs.
 */
function baseSignature(dataset: Dataset): string {
  return dataset.columns
    .filter((c) => !c.derived)
    .map((c) => c.key)
    .join('|');
}

/** One remembered computed column: its generated key + the recipe to rebuild it. */
interface DerivedEntry {
  key: string;
  spec: DerivedSpec;
}
interface Entry {
  derived: DerivedEntry[];
  savedAt: number;
}
type Store = Record<string, Entry>;

function readAll(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function writeAll(store: Store): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota exceeded / private mode — fail silently.
  }
}

function prune(store: Store): void {
  const sigs = Object.keys(store);
  if (sigs.length > MAX_SIGNATURES) {
    sigs
      .sort((a, b) => store[a].savedAt - store[b].savedAt)
      .slice(0, sigs.length - MAX_SIGNATURES)
      .forEach((s) => delete store[s]);
  }
}

/** Remembered computed-column specs for a dataset's source structure, in order. */
export function getDerivedSpecs(dataset: Dataset): DerivedSpec[] {
  return (readAll()[baseSignature(dataset)]?.derived ?? []).map((e) => e.spec);
}

/** Persists one computed column (its generated key + spec), keyed by structure. */
export function addDerivedSpec(
  dataset: Dataset,
  key: string,
  spec: DerivedSpec,
): void {
  const sig = baseSignature(dataset);
  const store = readAll();
  const entry = store[sig] ?? { derived: [], savedAt: 0 };
  // Replace any existing entry with the same key (re-add), else append.
  entry.derived = [...entry.derived.filter((e) => e.key !== key), { key, spec }];
  entry.savedAt = Date.now();
  store[sig] = entry;
  prune(store);
  writeAll(store);
}

/** Forgets a single computed column by its generated key. */
export function removeDerivedSpec(dataset: Dataset, key: string): void {
  const sig = baseSignature(dataset);
  const store = readAll();
  const entry = store[sig];
  if (!entry) return;
  entry.derived = entry.derived.filter((e) => e.key !== key);
  entry.savedAt = Date.now();
  if (entry.derived.length === 0) delete store[sig];
  else store[sig] = entry;
  writeAll(store);
}
