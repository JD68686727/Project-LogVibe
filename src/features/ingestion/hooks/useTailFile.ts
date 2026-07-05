import { useCallback, useEffect, useRef, useState } from 'react';
import Papa from 'papaparse';
import type { Dataset } from '@/types/dataset';
import { assembleDataset } from '@/lib/csv/assembleDataset';
import { decodeBytes, readFileSmart, type Encoding } from '@/lib/csv/encoding';
import { splitAppended } from '@/lib/csv/splitAppended';
import { readAppended, type FileLike, type TailReadState } from '@/lib/csv/tailReader';
import { appendRows, MAX_ROWS } from '@/lib/csv/appendRows';

const POLL_MS = 1000;

type FilePicker = (options?: unknown) => Promise<FileLike[]>;
function getPicker(): FilePicker | undefined {
  return (window as unknown as { showOpenFilePicker?: FilePicker }).showOpenFilePicker;
}

export interface TailStatus {
  /** File System Access API present (Chromium/Edge). */
  supported: boolean;
  active: boolean;
  paused: boolean;
  fileName: string | null;
  fileId: string | null;
  atCap: boolean;
  error: string | null;
}

export interface UseTailFile extends TailStatus {
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

export interface UseTailFileDeps {
  addDataset: (dataset: Dataset) => string;
  updateDataset: (fileId: string, updater: (prev: Dataset) => Dataset) => void;
}

/**
 * Live-tails an appended text file (CSV/TSV) via the File System Access API:
 * an initial parse lands a normal dataset, then a poll loop reads the bytes
 * appended since the last read and grows the dataset in place. 100% local;
 * Chromium/Edge only. The correctness core (readAppended/appendRows) is pure and
 * unit-tested; this hook wires the picker, initial parse, and cadence.
 */
export function useTailFile({ addDataset, updateDataset }: UseTailFileDeps): UseTailFile {
  const supported = typeof getPicker() === 'function';
  const [status, setStatus] = useState<TailStatus>({
    supported,
    active: false,
    paused: false,
    fileName: null,
    fileId: null,
    atCap: false,
    error: null,
  });

  const handleRef = useRef<FileLike | null>(null);
  const readStateRef = useRef<TailReadState>({ offset: 0, remainder: '' });
  const fileIdRef = useRef<string | null>(null);
  const delimiterRef = useRef(',');
  const encodingRef = useRef<Encoding>('utf-8');
  const rowCountRef = useRef(0);
  const atCapRef = useRef(false);

  const start = useCallback(async () => {
    const picker = getPicker();
    if (!picker) return;
    let handle: FileLike;
    try {
      [handle] = await picker({ multiple: false });
    } catch {
      return; // user cancelled the picker
    }

    const file = await handle.getFile();
    const { text, encoding } = await readFileSmart(file);
    // Hold back a partial trailing line so appends continue it cleanly.
    const { lines, remainder } = splitAppended('', text);
    const result = Papa.parse<string[]>(lines.join('\n'), {
      skipEmptyLines: 'greedy',
    });
    const rows = result.data as string[][];
    const headers = rows[0] ?? [];
    const body = rows.slice(1, MAX_ROWS + 1);
    const delimiter = result.meta.delimiter || ',';

    const dataset = assembleDataset(headers, body, {
      fileName: file.name,
      fileSize: file.size,
      delimiter,
      truncated: rows.length - 1 > MAX_ROWS,
      encoding,
    });
    const id = addDataset(dataset);

    handleRef.current = handle;
    readStateRef.current = { offset: file.size, remainder };
    fileIdRef.current = id;
    delimiterRef.current = delimiter;
    encodingRef.current = encoding;
    rowCountRef.current = dataset.rows.length;
    atCapRef.current = false;

    setStatus({
      supported: true,
      active: true,
      paused: false,
      fileName: file.name,
      fileId: id,
      atCap: false,
      error: null,
    });
  }, [addDataset]);

  const pause = useCallback(() => setStatus((s) => ({ ...s, paused: true })), []);
  const resume = useCallback(() => setStatus((s) => ({ ...s, paused: false })), []);
  const stop = useCallback(() => {
    handleRef.current = null;
    fileIdRef.current = null;
    setStatus((s) => ({ ...s, active: false, paused: false }));
  }, []);

  // Poll loop — a self-scheduling timeout (not setInterval) so a slow tick never
  // overlaps the next. Runs only while active and not paused.
  useEffect(() => {
    if (!status.active || status.paused) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      const handle = handleRef.current;
      const fileId = fileIdRef.current;
      if (!handle || !fileId) return;
      try {
        const { lines, state } = await readAppended(handle, readStateRef.current, (buf) =>
          decodeBytes(buf, encodingRef.current),
        );
        readStateRef.current = state;
        if (cancelled || lines.length === 0) return;

        const parsed = Papa.parse<string[]>(lines.join('\n'), {
          delimiter: delimiterRef.current,
          skipEmptyLines: 'greedy',
        }).data as string[][];
        if (parsed.length === 0) return;

        const room = MAX_ROWS - rowCountRef.current;
        if (room <= 0) {
          if (!atCapRef.current) {
            atCapRef.current = true;
            setStatus((s) => ({ ...s, atCap: true }));
          }
          return;
        }
        const toAdd = parsed.length > room ? parsed.slice(0, room) : parsed;
        rowCountRef.current += toAdd.length;
        updateDataset(fileId, (prev) => appendRows(prev, toAdd).dataset);
        if (toAdd.length < parsed.length && !atCapRef.current) {
          atCapRef.current = true;
          setStatus((s) => ({ ...s, atCap: true }));
        }
      } catch {
        if (cancelled) return;
        handleRef.current = null;
        setStatus((s) => ({
          ...s,
          active: false,
          error: 'Lost access to the file — stopped tailing.',
        }));
      }
    };

    const loop = async () => {
      if (cancelled) return;
      await tick();
      if (!cancelled) timer = setTimeout(loop, POLL_MS);
    };
    timer = setTimeout(loop, POLL_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [status.active, status.paused, updateDataset]);

  return { ...status, start, pause, resume, stop };
}
