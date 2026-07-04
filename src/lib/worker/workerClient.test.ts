import { describe, it, expect, vi } from 'vitest';
import { createWorkerClient } from './workerClient';

/** A minimal fake Worker that records posts and lets the test drive replies. */
function fakeWorker() {
  const posted: unknown[] = [];
  return {
    posted,
    terminate: vi.fn(),
    onmessage: null as ((e: MessageEvent) => void) | null,
    onerror: null as ((e: unknown) => void) | null,
    postMessage(m: unknown) {
      posted.push(m);
    },
  };
}

describe('createWorkerClient', () => {
  it('posts a request with an id and resolves the correlated result', async () => {
    const w = fakeWorker();
    const client = createWorkerClient<{ n: number }, number>(w as unknown as Worker);
    const p = client.run({ n: 21 });
    expect(w.posted[0]).toEqual({ id: 0, request: { n: 21 } });
    w.onmessage?.({ data: { id: 0, result: 42 } } as MessageEvent);
    await expect(p).resolves.toBe(42);
  });

  it('rejects when the worker replies with an error', async () => {
    const w = fakeWorker();
    const client = createWorkerClient<unknown, unknown>(w as unknown as Worker);
    const p = client.run({});
    w.onmessage?.({ data: { id: 0, error: 'boom' } } as MessageEvent);
    await expect(p).rejects.toThrow('boom');
  });

  it('correlates overlapping requests by id and ignores unknown ids', async () => {
    const w = fakeWorker();
    const client = createWorkerClient<number, number>(w as unknown as Worker);
    const a = client.run(1);
    const b = client.run(2);
    w.onmessage?.({ data: { id: 99, result: -1 } } as MessageEvent); // unknown → ignored
    w.onmessage?.({ data: { id: 1, result: 200 } } as MessageEvent);
    w.onmessage?.({ data: { id: 0, result: 100 } } as MessageEvent);
    await expect(a).resolves.toBe(100);
    await expect(b).resolves.toBe(200);
  });

  it('terminate() tears down the worker', () => {
    const w = fakeWorker();
    const client = createWorkerClient(w as unknown as Worker);
    client.terminate();
    expect(w.terminate).toHaveBeenCalled();
  });
});
