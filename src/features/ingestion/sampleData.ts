import serverLogs from '../../../samples/server-logs.csv?raw';
import webAttack from '../../../samples/web-attack.csv?raw';
import authEvents from '../../../samples/auth-events.csv?raw';

export interface SampleFile {
  id: string;
  label: string;
  description: string;
  fileName: string;
  content: string;
}

/**
 * Bundled demo files for one-click onboarding. Kept tiny and inlined via Vite's
 * `?raw` import so loading a sample needs no network request — consistent with
 * the local-first promise.
 */
export const SAMPLES: SampleFile[] = [
  {
    id: 'server-logs',
    label: 'Server logs',
    description: 'HTTP requests — status, latency, endpoints',
    fileName: 'server-logs.csv',
    content: serverLogs,
  },
  {
    id: 'web-attack',
    label: 'Web attack',
    description: 'Probing traffic — try the Security scan',
    fileName: 'web-attack.csv',
    content: webAttack,
  },
  {
    id: 'auth-events',
    label: 'Auth events',
    description: 'Failed logins — brute-force demo',
    fileName: 'auth-events.csv',
    content: authEvents,
  },
];

/** Wraps a sample's text in a File so it flows through the normal parse path. */
export function sampleToFile(sample: SampleFile): File {
  return new File([sample.content], sample.fileName, { type: 'text/csv' });
}
