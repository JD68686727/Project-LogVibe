import { useEffect, useRef } from 'react';
import type { Finding, Severity } from '@/lib/analysis/findings';
import { SEVERITY_RANK } from '@/lib/analysis/findings';
import { alertKey, newAlertKeys, notify, playBeep } from '@/lib/alert/notify';

export interface FindingAlertOptions {
  enabled: boolean;
  /** Minimum severity that raises an alert (default 'high'). */
  minSeverity?: Severity;
}

/**
 * Raises a desktop notification (+ beep) when a *new* finding at/above
 * `minSeverity` appears — used while live-tailing so threats page you. On
 * enabling, the current backlog is primed as "seen" so only findings that land
 * afterwards alert. Resets when disabled (a new tail session starts fresh).
 */
export function useFindingAlerts(
  findings: Finding[],
  { enabled, minSeverity = 'high' }: FindingAlertOptions,
): void {
  const seenRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      seenRef.current = new Set();
      primedRef.current = false;
      return;
    }
    const minRank = SEVERITY_RANK[minSeverity];

    if (!primedRef.current) {
      // Seed with the existing findings so we don't alert on the backlog.
      for (const key of newAlertKeys(new Set(), findings, minRank)) {
        seenRef.current.add(key);
      }
      primedRef.current = true;
      return;
    }

    const keys = newAlertKeys(seenRef.current, findings, minRank);
    if (keys.length === 0) return;
    for (const key of keys) seenRef.current.add(key);

    const first = findings.find((f) => alertKey(f) === keys[0]);
    const body =
      keys.length === 1 && first
        ? `${first.rule}: ${first.entity} — ${first.detail}`
        : `${keys.length} new high-severity findings`;
    notify('LogVibe — threat detected', body);
    playBeep();
  }, [findings, enabled, minSeverity]);
}
