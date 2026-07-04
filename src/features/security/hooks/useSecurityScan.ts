import { useEffect, useState } from 'react';
import type { Dataset } from '@/types/dataset';
import type { Finding } from '@/lib/analysis/findings';
import { runProfiles } from '@/lib/security/profiles';
import { createWorkerClient, type WorkerClient } from '@/lib/worker/workerClient';
import type { ScanRequest } from '../workers/scan.worker';

export interface SecurityScanState {
  findings: Finding[];
  scanning: boolean;
}

/**
 * Runs the defensive profiles off the main thread so the UI stays responsive on
 * large views (the detectors scan whole-row text + regex per row — the heaviest
 * pass in the app). Falls back to a synchronous main-thread run if a Worker
 * can't be created. The scan is a one-shot per open, so cloning the dataset to
 * the worker is an acceptable, off-critical-path cost.
 */
export function useSecurityScan(dataset: Dataset, order: number[]): SecurityScanState {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let client: WorkerClient<ScanRequest, Finding[]> | null = null;

    const runOnMainThread = () => {
      if (cancelled) return;
      setFindings(runProfiles(dataset, order));
      setScanning(false);
    };

    setScanning(true);
    try {
      const worker = new Worker(
        new URL('../workers/scan.worker.ts', import.meta.url),
        { type: 'module' },
      );
      client = createWorkerClient<ScanRequest, Finding[]>(worker);
      client
        .run({ dataset, order })
        .then((result) => {
          if (cancelled) return;
          setFindings(result);
          setScanning(false);
        })
        .catch(runOnMainThread);
    } catch {
      runOnMainThread();
    }

    return () => {
      cancelled = true;
      client?.terminate();
    };
  }, [dataset, order]);

  return { findings, scanning };
}
