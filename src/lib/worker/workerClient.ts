export interface WorkerClient<Req, Res> {
  /** Sends a request and resolves with the worker's correlated response. */
  run(request: Req): Promise<Res>;
  /** Terminates the worker and rejects any in-flight requests. */
  terminate(): void;
}

interface Pending<Res> {
  resolve: (value: Res) => void;
  reject: (error: Error) => void;
}

/**
 * A small promise-based wrapper around a Worker. Each request gets an
 * incrementing id so overlapping/stale responses resolve independently. The
 * worker must reply with `{ id, result }` on success or `{ id, error }` on
 * failure. Reusable for any offloaded task — the security scan today, and the
 * planned live-tail / windowed-file parsing later.
 */
export function createWorkerClient<Req, Res>(worker: Worker): WorkerClient<Req, Res> {
  let nextId = 0;
  const pending = new Map<number, Pending<Res>>();

  worker.onmessage = (e: MessageEvent) => {
    const { id, result, error } = e.data as {
      id: number;
      result?: Res;
      error?: string;
    };
    const p = pending.get(id);
    if (!p) return; // unknown/stale id — ignore
    pending.delete(id);
    if (error) p.reject(new Error(error));
    else p.resolve(result as Res);
  };

  worker.onerror = () => {
    for (const p of pending.values()) p.reject(new Error('worker error'));
    pending.clear();
  };

  return {
    run(request: Req): Promise<Res> {
      const id = nextId++;
      return new Promise<Res>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, request });
      });
    },
    terminate() {
      worker.terminate();
      pending.clear();
    },
  };
}
