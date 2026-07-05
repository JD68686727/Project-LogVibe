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
 * Keeps a running threat-finding count for a growing dataset — used while live
 * tailing so findings update as events land. Re-scans off the main thread (one
 * reused worker per session, with a synchronous fallback), debounced so rapid
 * appends don't thrash. Inactive → count 0, no worker.
 */
export function useLiveScan(
  dataset: Dataset | null,
  active: boolean,
): { count: number; scanning: boolean } {
  const [state, setState] = useState({ count: 0, scanning: false });
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
      setState({ count: 0, scanning: false });
      return;
    }
    const timer = setTimeout(async () => {
      const order = dataset.rows.map((_, i) => i);
      setState((s) => ({ ...s, scanning: true }));
      try {
        const client = clientRef.current;
        const findings = client
          ? await client.run({ dataset, order })
          : runProfiles(dataset, order);
        setState({ count: findings.length, scanning: false });
      } catch {
        setState({ count: runProfiles(dataset, order).length, scanning: false });
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [dataset, active]);

  return state;
}
