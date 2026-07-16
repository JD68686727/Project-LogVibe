import { useCallback, useEffect, useRef, useState } from 'react';
import Papa from 'papaparse';
import type { Dataset } from '@/types/dataset';
import type { LogPattern } from '@/types/logPattern';
import { assembleDataset } from '@/lib/csv/assembleDataset';
import { decodeBytes, readFileSmart, type Encoding } from '@/lib/csv/encoding';
import { splitAppended } from '@/lib/csv/splitAppended';
import { readAppended, type FileLike, type TailReadState } from '@/lib/csv/tailReader';
import { appendRows, MAX_ROWS } from '@/lib/csv/appendRows';
import { recomputeDerived } from '@/lib/table/deriveColumn';
import { getDerivedSpecs } from '@/lib/storage/derivedColumnStore';
import { getTailKeepLast } from '@/lib/storage/tailBufferStore';
import { useI18n } from '@/lib/i18n/I18nContext';
import { compilePattern, parseLine } from '@/lib/log/regexParser';

interface CompiledPattern {
  re: RegExp;
  fields: string[];
}

/** Parses complete lines to raw rows — CSV via PapaParse, or a named-group
 *  regex for custom logs (non-matching lines are skipped). */
function parseLines(
  lines: string[],
  delimiter: string,
  pattern: CompiledPattern | null,
): string[][] {
  if (pattern) {
    const out: string[][] = [];
    for (const line of lines) {
      const row = parseLine(pattern.re, pattern.fields, line);
      if (row) out.push(row);
    }
    return out;
  }
  return Papa.parse<string[]>(lines.join('\n'), {
    delimiter,
    skipEmptyLines: 'greedy',
  }).data as string[][];
}

const POLL_MS = 1000;

/** Appends raw rows, then refreshes any computed columns so tail-appended rows
 *  get real derived values instead of null (robust to ring-buffer eviction). */
function appendWithDerived(
  prev: Dataset,
  rawRows: string[][],
  keepLast: number | null,
): Dataset {
  const grown = appendRows(prev, rawRows, MAX_ROWS, keepLast ?? undefined).dataset;
  const specs = getDerivedSpecs(prev);
  return specs.length ? recomputeDerived(grown, specs) : grown;
}

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
  /** Starts tailing; pass a LogPattern to parse a custom log instead of CSV. */
  start: (pattern?: LogPattern) => Promise<void>;
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
  const { t } = useI18n();
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
  const patternRef = useRef<CompiledPattern | null>(null);
  const rowCountRef = useRef(0);
  const atCapRef = useRef(false);
  const keepLastRef = useRef<number | null>(null);

  const start = useCallback(
    async (pattern?: LogPattern) => {
      const picker = getPicker();
      if (!picker) return;
      let handle: FileLike;
      try {
        [handle] = await picker({ multiple: false });
      } catch {
        return; // user cancelled the picker
      }

      // Reading can fail (permission revoked, file moved) — surface it instead
      // of leaving an unhandled rejection and a UI that silently does nothing.
      let file: File;
      let text: string;
      let encoding: Encoding;
      try {
        file = await handle.getFile();
        ({ text, encoding } = await readFileSmart(file));
      } catch {
        setStatus((s) => ({ ...s, error: t('tail.openFailed') }));
        return;
      }
      // Hold back a partial trailing line so appends continue it cleanly.
      const { lines, remainder } = splitAppended('', text);

      let dataset: Dataset;
      let delimiter = '';
      let compiled: CompiledPattern | null = null;

      if (pattern) {
        const res = compilePattern(pattern);
        if (!res.ok) return; // the builder validated it, so this is defensive
        compiled = { re: res.re, fields: res.fields };
        const rows = parseLines(lines, '', compiled).slice(0, MAX_ROWS);
        dataset = assembleDataset(compiled.fields, rows, {
          fileName: file.name,
          fileSize: file.size,
          delimiter: '',
          truncated: false,
          encoding,
        });
      } else {
        const result = Papa.parse<string[]>(lines.join('\n'), {
          skipEmptyLines: 'greedy',
        });
        const parsed = result.data as string[][];
        const headers = parsed[0] ?? [];
        const body = parsed.slice(1, MAX_ROWS + 1);
        delimiter = result.meta.delimiter || ',';
        dataset = assembleDataset(headers, body, {
          fileName: file.name,
          fileSize: file.size,
          delimiter,
          truncated: parsed.length - 1 > MAX_ROWS,
          encoding,
        });
      }

      const id = addDataset(dataset);

      handleRef.current = handle;
      readStateRef.current = { offset: file.size, remainder };
      fileIdRef.current = id;
      delimiterRef.current = delimiter;
      encodingRef.current = encoding;
      patternRef.current = compiled;
      rowCountRef.current = dataset.rows.length;
      atCapRef.current = false;
      keepLastRef.current = getTailKeepLast(); // ring-buffer window, if configured

      setStatus({
        supported: true,
        active: true,
        paused: false,
        fileName: file.name,
        fileId: id,
        atCap: false,
        error: null,
      });
    },
    [addDataset, t],
  );

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

        const parsed = parseLines(lines, delimiterRef.current, patternRef.current);
        if (parsed.length === 0) return;

        // Ring-buffer mode: never hit the cap — evict the oldest beyond the
        // window so a long tail stays memory-bounded.
        const keepLast = keepLastRef.current;
        if (keepLast != null) {
          rowCountRef.current = Math.min(rowCountRef.current + parsed.length, keepLast);
          updateDataset(fileId, (prev) => appendWithDerived(prev, parsed, keepLast));
          return;
        }

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
        updateDataset(fileId, (prev) => appendWithDerived(prev, toAdd, null));
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
          error: t('tail.lostAccess'),
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
  }, [status.active, status.paused, updateDataset, t]);

  return { ...status, start, pause, resume, stop };
}
