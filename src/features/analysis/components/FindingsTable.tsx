import { sortFindings, type Finding } from '@/lib/analysis/findings';
import { SeverityBadge } from './SeverityBadge';

/** Compact, read-only table of findings, sorted most-severe first. */
export function FindingsTable({
  findings,
  cap = 200,
}: {
  findings: Finding[];
  cap?: number;
}) {
  const rows = sortFindings(findings).slice(0, cap);
  const showTechnique = rows.some((f) => f.technique);
  return (
    <div className="overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="w-full text-xs" data-testid="findings-table">
        <thead className="bg-slate-50 text-left font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <tr>
            <th className="px-2 py-1.5">Severity</th>
            <th className="px-2 py-1.5">Rule</th>
            {showTechnique && <th className="px-2 py-1.5">ATT&amp;CK</th>}
            <th className="px-2 py-1.5">Entity</th>
            <th className="px-2 py-1.5">Detail</th>
            <th className="px-2 py-1.5 text-right">Count</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((f, i) => (
            <tr key={`${f.rule}-${f.entity}-${i}`}>
              <td className="px-2 py-1">
                <SeverityBadge severity={f.severity} />
              </td>
              <td className="whitespace-nowrap px-2 py-1 font-mono text-slate-500 dark:text-slate-400">
                {f.rule}
              </td>
              {showTechnique && (
                <td className="whitespace-nowrap px-2 py-1 text-slate-500 dark:text-slate-400">
                  {f.technique ?? ''}
                </td>
              )}
              <td className="whitespace-nowrap px-2 py-1 font-mono text-slate-700 dark:text-slate-200">
                {f.entity}
              </td>
              <td className="px-2 py-1 text-slate-600 dark:text-slate-300">
                {f.detail}
              </td>
              <td className="px-2 py-1 text-right font-mono text-slate-500 dark:text-slate-400">
                {f.count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
