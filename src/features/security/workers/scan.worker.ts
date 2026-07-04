import type { Dataset } from '@/types/dataset';
import { runProfiles } from '@/lib/security/profiles';

export interface ScanRequest {
  dataset: Dataset;
  order: number[];
}

// Typed view of the worker global that avoids needing the webworker lib.
const ctx = self as unknown as {
  postMessage(message: unknown): void;
  onmessage: ((e: MessageEvent) => void) | null;
};

ctx.onmessage = (e: MessageEvent) => {
  const { id, request } = e.data as { id: number; request: ScanRequest };
  try {
    const result = runProfiles(request.dataset, request.order);
    ctx.postMessage({ id, result });
  } catch (err) {
    ctx.postMessage({
      id,
      error: err instanceof Error ? err.message : 'scan failed',
    });
  }
};
