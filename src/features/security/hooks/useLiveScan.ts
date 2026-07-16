import { useEffect, useRef, useState } from 'react';
import type { Dataset } from '@/types/dataset';
import type { Finding } from '@/lib/analysis/findings';
import { runProfiles } from '@/lib/security/profiles';
import { createWorkerClient, type WorkerClient } from '@/lib/worker/workerClient';
import type { ScanRequest } from '../workers/scan.worker';

/** Debounce after the last dataset change before re-scanning, to coalesce a
 *  burst of appended rows into one scan. */
const DEBOUNCE_MS = 1500;

/**
 * Live scanning only needs recent activity, so it runs over at most the newest
 * `LIVE_SCAN_WINDOW` rows. This bounds both the per-tick work *and* the
 * structured-clone cost to the worker — otherwise a long tail would clone and
 * re-scan the entire (growing) dataset every debounce, which is O(n²).
 */
export const LIVE_SCAN_WINDOW = 50_000;

/** The dataset + full-order to scan: the whole thing when small, else a
 *  cheaply-sliced tail of the newest rows. Pure, so it's unit-tested. */
export function tailWindow(
  dataset: Dataset,
  max = LIVE_SCAN_WINDOW,
): { dataset: Dataset; order: number[] } {
  const total = dataset.rows.length;
  if (total <= max) {
    return { dataset, order: dataset.rows.map((_, i) => i) };
  }
  const rows = dataset.rows.slice(total - max);
  return {
    dataset: { ...dataset, rows, meta: { ...dataset.meta, rowCount: rows.length } },
    order: rows.map((_, i) => i),
  };
}

/**
 * Keeps a running threat-finding count for a growing dataset — used while live
 * tailing so findings update as events land. Re-scans off the main thread (one
 * reused worker per session, with a synchronous fallback), debounced so rapid
 * appends don't thrash. Inactive → count 0, no worker.
 */
export function useLiveScan(
  dataset: Dataset | null,
  active: boolean,
): { findings: Finding[]; count: number; scanning: boolean } {
  const [state, setState] = useState<{ findings: Finding[]; scanning: boolean }>({
    findings: [],
    scanning: false,
  });
  const clientRef = useRef<WorkerClient<ScanRequest, Finding[]> | null>(null);

  // One worker for the whole tailing session.
  useEffect(() => {
    if (!active) return;
    try {
      const worker = new Worker(
        new URL('../workers/scan.worker.ts', import.meta.url),
        { type: 'module' },
      );
      clientRef.current = createWorkerClient<ScanRequest, Finding[]>(worker);
    } catch {
      clientRef.current = null; // fall back to main-thread scans
    }
    return () => {
      clientRef.current?.terminate();
      clientRef.current = null;
    };
  }, [active]);

  // Debounced re-scan whenever the dataset grows.
  useEffect(() => {
    if (!active || !dataset) {
      setState({ findings: [], scanning: false });
      return;
    }
    const timer = setTimeout(async () => {
      const { dataset: scanDs, order } = tailWindow(dataset);
      setState((s) => ({ ...s, scanning: true }));
      try {
        const client = clientRef.current;
        const findings = client
          ? await client.run({ dataset: scanDs, order })
          : runProfiles(scanDs, order);
        setState({ findings, scanning: false });
      } catch {
        setState({ findings: runProfiles(scanDs, order), scanning: false });
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [dataset, active]);

  return { findings: state.findings, count: state.findings.length, scanning: state.scanning };
}
