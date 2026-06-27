import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Dataset } from '@/types/dataset';
import type { SavedLogPattern } from '@/types/logPattern';
import { cn } from '@/utils/cn';
import { btnSecondary, inputCls } from '@/utils/controls';
import { assembleDataset } from '@/lib/csv/assembleDataset';
import { compilePattern, parseLogText } from '@/lib/log/regexParser';
import { ACCEPTED } from '../acceptedTypes';
import { useLogPatterns } from '../hooks/useLogPatterns';

interface Template {
  label: string;
  regex: string;
  flags: string;
  sample: string;
}

const TEMPLATES: Template[] = [
  {
    label: 'Nginx / Apache access',
    regex:
      '^(?<ip>\\S+) \\S+ \\S+ \\[(?<time>[^\\]]+)\\] "(?<request>[^"]*)" (?<status>\\d+) (?<bytes>\\S+)(?: "(?<referer>[^"]*)" "(?<agent>[^"]*)")?',
    flags: '',
    sample:
      '127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /api/users HTTP/1.1" 200 1234 "-" "Mozilla/5.0"\n' +
      '10.0.0.9 - - [10/Oct/2023:13:55:40 +0000] "POST /api/login HTTP/1.1" 401 64 "-" "curl/8.0"',
  },
  {
    label: 'syslog',
    regex:
      '^(?<time>\\w{3}\\s+\\d+ \\d{2}:\\d{2}:\\d{2}) (?<host>\\S+) (?<process>[^:]+): (?<message>.*)$',
    flags: '',
    sample:
      'Oct 10 13:55:36 myhost sshd[1234]: Failed password for root from 10.0.0.5\n' +
      'Oct 10 13:55:41 myhost cron[55]: session opened for user root',
  },
  {
    label: 'App log (level + message)',
    regex:
      '^(?<time>\\d{4}-\\d{2}-\\d{2}[ T]\\d{2}:\\d{2}:\\d{2}[.,\\d]*)\\s+(?<level>[A-Z]+)\\s+(?<message>.*)$',
    flags: '',
    sample:
      '2026-06-26 13:55:36.123 ERROR Payment service timed out after 3s\n' +
      '2026-06-26 13:55:37.001 INFO Retrying request id=42',
  },
];

const CHIPS: { label: string; snippet: string }[] = [
  { label: 'Timestamp', snippet: '(?<timestamp>\\S+)' },
  { label: 'Level', snippet: '(?<level>[A-Z]+)' },
  { label: 'Component', snippet: '(?<component>\\S+)' },
  { label: 'Message', snippet: '(?<message>.*)' },
  { label: 'IP', snippet: '(?<ip>\\S+)' },
  { label: 'Status', snippet: '(?<status>\\d+)' },
];

const PREVIEW_ROWS = 8;
const section = 'text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500';

export interface LogPatternBuilderProps {
  onDataset: (dataset: Dataset) => void;
  onClose: () => void;
}

/** Modal to map an unstructured log into the dataset schema via a named-group regex. */
export function LogPatternBuilder({ onDataset, onClose }: LogPatternBuilderProps) {
  const [sample, setSample] = useState(TEMPLATES[0].sample);
  const [regex, setRegex] = useState(TEMPLATES[0].regex);
  const [flags, setFlags] = useState(TEMPLATES[0].flags);
  const [file, setFile] = useState<File | null>(null);
  const [presetName, setPresetName] = useState('');
  const [busy, setBusy] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const patternRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const presets = useLogPatterns();

  // Compile + preview are the only derived work — recomputed on edits, not the
  // heavy full-file parse (that runs once, on submit).
  const compiled = useMemo(() => compilePattern({ regex, flags }), [regex, flags]);
  const preview = useMemo(
    () =>
      compiled.ok
        ? parseLogText(sample, { regex, flags }, { maxRows: PREVIEW_ROWS + 4 })
        : null,
    [compiled.ok, sample, regex, flags],
  );

  const applyTemplate = (t: Template) => {
    setRegex(t.regex);
    setFlags(t.flags);
    if (!file) setSample(t.sample);
    setParseError(null);
  };

  const applyPreset = (p: SavedLogPattern) => {
    setRegex(p.regex);
    setFlags(p.flags);
    setParseError(null);
  };

  const insertChip = (snippet: string) => {
    const el = patternRef.current;
    const start = el?.selectionStart ?? regex.length;
    const end = el?.selectionEnd ?? regex.length;
    setRegex(regex.slice(0, start) + snippet + regex.slice(end));
    const caret = start + snippet.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  const loadFromFile = async (f: File) => {
    setFile(f);
    setParseError(null);
    const head = await f.slice(0, 64 * 1024).text();
    setSample(head.split(/\r?\n/).slice(0, 50).join('\n'));
  };

  const handleParse = async () => {
    if (!file || !compiled.ok) return;
    setBusy(true);
    setParseError(null);
    try {
      const result = parseLogText(await file.text(), { regex, flags });
      if (result.rows.length === 0) {
        setParseError('No lines in the file matched the pattern.');
        return;
      }
      onDataset(
        assembleDataset(result.headers, result.rows, {
          fileName: file.name,
          fileSize: file.size,
          delimiter: '',
          truncated: result.truncated,
        }),
      );
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const headers = compiled.ok ? compiled.fields : [];
  const canParse = !!file && compiled.ok && (preview?.matched ?? 0) > 0 && !busy;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto p-4 sm:p-8">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Custom log format"
        data-testid="log-pattern-builder"
        className="relative z-10 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Custom log format
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Map an unstructured log into columns with a named-group regex — 100% local.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-auto px-5 py-4">
          {/* Templates */}
          <section className="space-y-1.5">
            <p className={section}>Start from a template</p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-brand-400 hover:text-brand-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </section>

          {/* Sample */}
          <section className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className={section}>Sample lines</p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={`${btnSecondary} px-2.5 py-1 text-xs`}
              >
                Load from file…
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED.join(',')}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void loadFromFile(f);
                  e.target.value = '';
                }}
              />
            </div>
            <textarea
              aria-label="Sample log lines"
              value={sample}
              onChange={(e) => setSample(e.target.value)}
              spellCheck={false}
              rows={4}
              className={cn(inputCls, 'w-full resize-y font-mono text-xs leading-relaxed')}
            />
            {file && (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                File: <span className="font-medium text-slate-600 dark:text-slate-300">{file.name}</span>
              </p>
            )}
          </section>

          {/* Pattern */}
          <section className="space-y-1.5">
            <p className={section}>Pattern (named groups → columns)</p>
            <div className="flex gap-2">
              <input
                ref={patternRef}
                aria-label="Log pattern regex"
                value={regex}
                onChange={(e) => setRegex(e.target.value)}
                spellCheck={false}
                className={cn(inputCls, 'flex-1 font-mono text-xs')}
              />
              <input
                aria-label="Regex flags"
                value={flags}
                onChange={(e) => setFlags(e.target.value)}
                placeholder="flags"
                spellCheck={false}
                className={cn(inputCls, 'w-16 font-mono text-xs')}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400 dark:text-slate-500">Insert:</span>
              {CHIPS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertChip(c.snippet)}
                  className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25"
                >
                  + {c.label}
                </button>
              ))}
            </div>
            {!compiled.ok && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                {compiled.error}
              </p>
            )}
          </section>

          {/* Preview */}
          <section className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className={section}>Preview</p>
              {preview && (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {preview.matched} matched · {preview.unmatched} unmatched
                </p>
              )}
            </div>
            {compiled.ok && headers.length > 0 && (preview?.rows.length ?? 0) > 0 ? (
              <div className="overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs" data-testid="log-preview">
                  <thead className="bg-slate-50 text-left font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                      {headers.map((h) => (
                        <th key={h} className="whitespace-nowrap px-2 py-1.5">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {preview!.rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                      <tr key={i}>
                        {headers.map((h, c) => (
                          <td
                            key={h}
                            className="max-w-[16rem] truncate px-2 py-1 font-mono text-slate-700 dark:text-slate-200"
                            title={row[c]}
                          >
                            {row[c]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
                {compiled.ok
                  ? 'No sample lines matched yet — adjust the pattern or paste a sample.'
                  : 'Fix the pattern to see a preview.'}
              </p>
            )}
          </section>

          {/* Presets */}
          <section className="space-y-1.5">
            <p className={section}>Saved patterns</p>
            <div className="flex gap-2">
              <input
                aria-label="Pattern name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="e.g. Nginx Access Log"
                className={cn(inputCls, 'flex-1')}
              />
              <button
                type="button"
                disabled={!presetName.trim() || !compiled.ok}
                onClick={() => {
                  presets.save(presetName, { regex, flags });
                  setPresetName('');
                }}
                className={cn(btnSecondary, 'disabled:opacity-40')}
              >
                Save
              </button>
            </div>
            {presets.patterns.length > 0 && (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {presets.patterns.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 px-3 py-1.5">
                    <button
                      type="button"
                      onClick={() => applyPreset(p)}
                      className="flex-1 truncate text-left text-sm text-slate-700 hover:text-brand-600 dark:text-slate-200 dark:hover:text-brand-300"
                    >
                      {p.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => presets.remove(p.id)}
                      aria-label={`Delete ${p.name}`}
                      className="text-xs font-medium text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {parseError ? (
              <span className="font-medium text-rose-600 dark:text-rose-400">{parseError}</span>
            ) : file ? (
              `Ready to parse ${file.name}`
            ) : (
              'Load a file to parse, then click Parse.'
            )}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className={btnSecondary}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!canParse}
              onClick={() => void handleParse()}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? 'Parsing…' : 'Parse file'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
