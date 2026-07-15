import { useCallback, useState } from 'react';
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
      setFiles((prev) =>
        prev.map((f) => {
          if (f.id !== fileId) return f;
          setColumnOverride(f.dataset, columnKey, type); // keyed by stable column keys
          return { ...f, dataset: retypeColumn(f.dataset, columnKey, type) };
        }),
      );
    },
    [],
  );

  const addDerivedColumn = useCallback((fileId: string, spec: DerivedSpec) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id !== fileId) return f;
        const dataset = deriveColumn(f.dataset, spec);
        if (dataset === f.dataset) return f; // no-op (missing source column)
        const newKey = dataset.columns[dataset.columns.length - 1].key;
        addDerivedSpec(f.dataset, newKey, spec); // remember for re-open
        return { ...f, dataset };
      }),
    );
  }, []);

  const removeColumn = useCallback((fileId: string, columnKey: string) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id !== fileId) return f;
        removeDerivedSpec(f.dataset, columnKey);
        return { ...f, dataset: dropColumn(f.dataset, columnKey) };
      }),
    );
  }, []);

  const applyDerivedSpecs = useCallback((fileId: string, specs: DerivedSpec[]) => {
    if (specs.length === 0) return;
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id !== fileId) return f;
        // Skip recipes already applied to this file (idempotent re-apply).
        const present = new Set(
          getDerivedSpecs(f.dataset).map((s) => JSON.stringify(s)),
        );
        let dataset = f.dataset;
        for (const spec of specs) {
          if (present.has(JSON.stringify(spec))) continue;
          const next = deriveColumn(dataset, spec);
          if (next === dataset) continue; // missing source column
          const newKey = next.columns[next.columns.length - 1].key;
          addDerivedSpec(f.dataset, newKey, spec);
          dataset = next;
        }
        return dataset === f.dataset ? f : { ...f, dataset };
      }),
    );
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
