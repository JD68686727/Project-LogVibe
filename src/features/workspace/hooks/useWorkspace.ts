import { useCallback, useRef, useState } from 'react';
import type { ColumnType, Dataset } from '@/types/dataset';
import type { LoadedFile } from '@/types/workspace';
import { retypeColumn, applyTypeOverrides } from '@/lib/table/retypeColumn';
import {
  deriveColumn,
  dropColumn,
  applyDerivedSpecs as replayDerivedSpecs,
  type DerivedSpec,
} from '@/lib/table/deriveColumn';
import { getColumnOverrides, setColumnOverride } from '@/lib/storage/columnTypeStore';
import {
  getDerivedSpecs,
  addDerivedSpec,
  removeDerivedSpec,
} from '@/lib/storage/derivedColumnStore';

let idCounter = 0;
const nextId = () => `file-${Date.now()}-${++idCounter}`;

export interface UseWorkspace {
  files: LoadedFile[];
  activeFile: LoadedFile | null;
  /** Adds a file and returns its new id (used by live tailing to update it). */
  addDataset: (dataset: Dataset) => string;
  /** Replaces a file's dataset via an updater (live tailing appends rows). */
  updateDataset: (fileId: string, updater: (prev: Dataset) => Dataset) => void;
  removeFile: (id: string) => void;
  /** Removes every loaded file (returns to the start screen). */
  clear: () => void;
  setActive: (id: string) => void;
  /** Override a column's inferred type; re-coerces cells and remembers it. */
  setColumnType: (fileId: string, columnKey: string, type: ColumnType) => void;
  /** Append a computed column (regex-extract) to a file's dataset. */
  addDerivedColumn: (fileId: string, spec: DerivedSpec) => void;
  /** Remove a column (used to undo a derived column) from a file's dataset. */
  removeColumn: (fileId: string, columnKey: string) => void;
  /** Apply computed-column recipes from a saved/shared view (skips ones already
   *  present), recreating them on the file. */
  applyDerivedSpecs: (fileId: string, specs: DerivedSpec[]) => void;
}

/** Holds the collection of loaded files and which one is active in Analyze mode. */
export function useWorkspace(): UseWorkspace {
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Mirrors `files` so the actions below can read the current dataset *outside*
  // their state updater. Updaters must stay pure — React may re-invoke them
  // (StrictMode, concurrent rendering), which would double-write localStorage.
  const filesRef = useRef<LoadedFile[]>(files);
  filesRef.current = files;
  const fileById = (id: string) => filesRef.current.find((f) => f.id === id);

  const addDataset = useCallback((dataset: Dataset) => {
    // Re-apply any type overrides + computed columns remembered for this structure.
    const overrides = getColumnOverrides(dataset);
    const typed = applyTypeOverrides(dataset, overrides);
    const ds = replayDerivedSpecs(typed, getDerivedSpecs(typed));
    const file: LoadedFile = { id: nextId(), dataset: ds };
    setFiles((prev) => [...prev, file]);
    setActiveId(file.id); // a newly loaded file becomes active
    return file.id;
  }, []);

  const updateDataset = useCallback(
    (fileId: string, updater: (prev: Dataset) => Dataset) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, dataset: updater(f.dataset) } : f,
        ),
      );
    },
    [],
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clear = useCallback(() => {
    setFiles([]);
    setActiveId(null);
  }, []);

  const setActive = useCallback((id: string) => setActiveId(id), []);

  const setColumnType = useCallback(
    (fileId: string, columnKey: string, type: ColumnType) => {
      const file = fileById(fileId);
      if (!file) return;
      setColumnOverride(file.dataset, columnKey, type); // keyed by stable column keys
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, dataset: retypeColumn(f.dataset, columnKey, type) } : f,
        ),
      );
    },
    [],
  );

  const addDerivedColumn = useCallback((fileId: string, spec: DerivedSpec) => {
    const file = fileById(fileId);
    if (!file) return;
    const dataset = deriveColumn(file.dataset, spec);
    if (dataset === file.dataset) return; // no-op (missing source / bad regex)
    const newKey = dataset.columns[dataset.columns.length - 1].key;
    addDerivedSpec(file.dataset, newKey, spec); // remember for re-open
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, dataset } : f)));
  }, []);

  const removeColumn = useCallback((fileId: string, columnKey: string) => {
    const file = fileById(fileId);
    if (!file) return;
    removeDerivedSpec(file.dataset, columnKey);
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, dataset: dropColumn(f.dataset, columnKey) } : f,
      ),
    );
  }, []);

  const applyDerivedSpecs = useCallback((fileId: string, specs: DerivedSpec[]) => {
    if (specs.length === 0) return;
    const file = fileById(fileId);
    if (!file) return;
    // Skip recipes already applied to this file (idempotent re-apply).
    const present = new Set(getDerivedSpecs(file.dataset).map((s) => JSON.stringify(s)));
    let dataset = file.dataset;
    for (const spec of specs) {
      if (present.has(JSON.stringify(spec))) continue;
      const next = deriveColumn(dataset, spec);
      if (next === dataset) continue; // missing source / bad regex
      const newKey = next.columns[next.columns.length - 1].key;
      addDerivedSpec(file.dataset, newKey, spec);
      dataset = next;
    }
    if (dataset === file.dataset) return;
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, dataset } : f)));
  }, []);

  // Derive the active file with a fallback so removing the active one (which
  // leaves `activeId` stale) still resolves to a valid file.
  const activeFile =
    files.find((f) => f.id === activeId) ?? files[files.length - 1] ?? null;

  return {
    files,
    activeFile,
    addDataset,
    updateDataset,
    removeFile,
    clear,
    setActive,
    setColumnType,
    addDerivedColumn,
    removeColumn,
    applyDerivedSpecs,
  };
}
