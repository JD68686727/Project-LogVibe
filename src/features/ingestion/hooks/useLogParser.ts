import { useCallback, useReducer, useRef } from 'react';
import Papa from 'papaparse';
import type { Dataset, ParseError, ParseState } from '@/types/dataset';
import { assembleDataset } from '@/lib/csv/assembleDataset';
import { decodeBytes, detectEncoding, type Encoding } from '@/lib/csv/encoding';
import { detectAdapter } from '@/lib/ingest/adapters/registry';
import { useI18n } from '@/lib/i18n/I18nContext';

// --- Configuration ----------------------------------------------------------

const MAX_ROWS = 500_000; // hard cap to protect the browser's memory

// --- State machine ----------------------------------------------------------

type Action =
  | { type: 'START' }
  | { type: 'PROGRESS'; progress: number }
  | { type: 'SUCCESS'; dataset: Dataset; errors: ParseError[] }
  | { type: 'ERROR'; errors: ParseError[] }
  | { type: 'RESET' };

const initialState: ParseState = {
  status: 'idle',
  dataset: null,
  errors: [],
  progress: 0,
};

function reducer(state: ParseState, action: Action): ParseState {
  switch (action.type) {
    case 'START':
      return { ...initialState, status: 'parsing' };
    case 'PROGRESS':
      return { ...state, progress: action.progress };
    case 'SUCCESS':
      return {
        status: 'success',
        dataset: action.dataset,
        errors: action.errors,
        progress: 100,
      };
    case 'ERROR':
      return { ...state, status: 'error', errors: action.errors, progress: 0 };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// --- Hook -------------------------------------------------------------------

export interface UseLogParser extends ParseState {
  parseFile: (file: File) => void;
  reset: () => void;
}

export function useLogParser(): UseLogParser {
  const { t } = useI18n();
  const [state, dispatch] = useReducer(reducer, initialState);

  // A token that invalidates an in-flight parse when a new file arrives.
  const runIdRef = useRef(0);

  const parseFile = useCallback((file: File) => {
    const runId = ++runIdRef.current;
    const isStale = () => runId !== runIdRef.current;

    dispatch({ type: 'START' });

    // Accumulators live in closures, NOT in React state, so the thousands of
    // streamed chunks never trigger a re-render. We commit once at the end.
    const rawRows: string[][] = [];
    const errors: ParseError[] = [];
    let headers: string[] = [];
    let detectedDelimiter = '';
    let truncated = false;

    const collectErrors = (errs: { code?: string; message: string; row?: number }[]) => {
      for (const err of errs) {
        errors.push({ code: err.code ?? 'PARSE_ERROR', message: err.message, row: err.row });
      }
    };

    /** Appends parsed rows; the first row is the header. Returns true at the cap. */
    const ingestRows = (data: string[][]): boolean => {
      let startIdx = 0;
      if (headers.length === 0 && data.length > 0) {
        headers = data[0];
        startIdx = 1;
      }
      for (let i = startIdx; i < data.length; i++) {
        if (rawRows.length >= MAX_ROWS) {
          truncated = true;
          return true;
        }
        rawRows.push(data[i]);
      }
      return false;
    };

    const commit = (encoding: Encoding) => {
      if (isStale()) return;
      if (headers.length === 0) {
        dispatch({
          type: 'ERROR',
          errors: [
            {
              code: 'EMPTY_FILE',
              message: t('parse.empty'),
            },
          ],
        });
        return;
      }
      const dataset: Dataset = assembleDataset(headers, rawRows, {
        fileName: file.name,
        fileSize: file.size,
        delimiter: detectedDelimiter || ',',
        truncated,
        encoding,
      });
      dispatch({ type: 'SUCCESS', dataset, errors });
    };

    // UTF-8 keeps the streaming Web Worker path (low memory on huge files); the
    // other encodings are read fully, re-decoded, then parsed from the string.
    const streamUtf8 = () => {
      Papa.parse<string[]>(file, {
        worker: true,
        skipEmptyLines: 'greedy',
        delimiter: '',
        chunk: (results, parser) => {
          if (isStale()) {
            parser.abort();
            return;
          }
          if (!detectedDelimiter && results.meta.delimiter) {
            detectedDelimiter = results.meta.delimiter;
          }
          const hitCap = ingestRows(results.data);
          collectErrors(results.errors);
          if (hitCap) {
            parser.abort();
            return;
          }
          const cursor = results.meta.cursor ?? 0;
          if (file.size > 0) {
            dispatch({
              type: 'PROGRESS',
              progress: Math.min(99, Math.round((cursor / file.size) * 100)),
            });
          }
        },
        complete: () => commit('utf-8'),
        error: (err: Error) => {
          if (!isStale()) {
            dispatch({ type: 'ERROR', errors: [{ code: 'FATAL', message: err.message }] });
          }
        },
      });
    };

    const parseDecoded = (text: string, encoding: Encoding) => {
      const res = Papa.parse<string[]>(text, {
        skipEmptyLines: 'greedy',
        delimiter: '',
      });
      if (isStale()) return;
      detectedDelimiter = res.meta.delimiter || '';
      ingestRows(res.data);
      collectErrors(res.errors);
      commit(encoding);
    };

    void (async () => {
      try {
        const headBuf = await file.slice(0, 4096).arrayBuffer();
        if (isStale()) return;
        const { encoding } = detectEncoding(
          new Uint8Array(headBuf),
          file.size > headBuf.byteLength,
        );

        // Network-artifact adapters (ARP, TShark…) get first refusal: sniff the
        // decoded head, and if one claims the format, parse via it. Adapters are
        // line-based, so this path reads the whole file (no worker streaming).
        const adapter = detectAdapter(decodeBytes(headBuf, encoding));
        if (adapter) {
          const text = decodeBytes(await file.arrayBuffer(), encoding);
          if (isStale()) return;
          const result = adapter.parse(text, { maxRows: MAX_ROWS });
          if (result.rows.length > 0) {
            const dataset = assembleDataset(result.headers, result.rows, {
              fileName: file.name,
              fileSize: file.size,
              delimiter: '',
              truncated: result.truncated,
              encoding,
            });
            if (!isStale()) dispatch({ type: 'SUCCESS', dataset, errors });
            return; // else fall through to the CSV parser
          }
        }

        if (encoding === 'utf-8') {
          streamUtf8();
        } else {
          const text = decodeBytes(await file.arrayBuffer(), encoding);
          if (isStale()) return;
          parseDecoded(text, encoding);
        }
      } catch (e) {
        if (!isStale()) {
          dispatch({
            type: 'ERROR',
            errors: [
              {
                code: 'FATAL',
                message: e instanceof Error ? e.message : t('parse.readError'),
              },
            ],
          });
        }
      }
    })();
  }, [t]);

  const reset = useCallback(() => {
    runIdRef.current++; // invalidate any in-flight parse
    dispatch({ type: 'RESET' });
  }, []);

  return { ...state, parseFile, reset };
}
