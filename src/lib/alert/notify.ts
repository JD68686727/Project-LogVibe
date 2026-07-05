import { SEVERITY_RANK, type Finding } from '@/lib/analysis/findings';

/** Stable per-finding key (rule + subject), for dedup across scans. */
export function alertKey(f: Finding): string {
  return `${f.rule} ${f.entity}`;
}

/**
 * Keys of findings at/above `minRank` (lower rank = more severe) that aren't
 * already in `seen`. Pure — the caller owns the `seen` set. Deduped within the
 * call. Used to fire an alert only for *newly appeared* high-severity findings.
 */
export function newAlertKeys(
  seen: Set<string>,
  findings: Finding[],
  minRank: number,
): string[] {
  const out: string[] = [];
  for (const f of findings) {
    if (SEVERITY_RANK[f.severity] > minRank) continue; // below the threshold
    const key = alertKey(f);
    if (!seen.has(key) && !out.includes(key)) out.push(key);
  }
  return out;
}

export function notifySupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Requests notification permission; resolves true only when granted. */
export async function requestNotifyPermission(): Promise<boolean> {
  if (!notifySupported()) return false;
  try {
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/** Raises a desktop notification, or no-ops without support/permission. */
export function notify(title: string, body: string): void {
  if (!notifySupported() || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body });
  } catch {
    // some browsers require a ServiceWorker for notifications — ignore.
  }
}

/** A short best-effort beep via WebAudio (no asset, no dependency). */
export function playBeep(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    osc.onended = () => void ctx.close();
  } catch {
    // best-effort only
  }
}
