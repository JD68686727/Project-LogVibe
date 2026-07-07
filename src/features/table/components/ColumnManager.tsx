import { useEffect, useRef, useState } from 'react';
import type { ColumnType } from '@/types/dataset';
import type { ArithmeticOp, DerivedSpec } from '@/lib/table/deriveColumn';
import { btnSecondary } from '@/utils/controls';
import type { ColumnManagerItem } from '../hooks/useColumnView';

export interface ColumnManagerProps {
  items: ColumnManagerItem[];
  onToggle: (key: string) => void;
  onMove: (key: string, dir: 'up' | 'down') => void;
  onShowAll: () => void;
  onReset: () => void;
  /** Override a column's inferred type. */
  onRetype?: (key: string, type: ColumnType) => void;
  /** Add a computed (regex-extract) column. */
  onAddDerived?: (spec: DerivedSpec) => void;
  /** Remove a column (only offered for derived columns). */
  onRemove?: (key: string) => void;
}

const COLUMN_TYPES: ColumnType[] = ['string', 'number', 'boolean', 'date'];

const moveBtnCls =
  'flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200';

export function ColumnManager({
  items,
  onToggle,
  onMove,
  onShowAll,
  onReset,
  onRetype,
  onAddDerived,
  onRemove,
}: ColumnManagerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // "Add computed column" form state.
  const [mode, setMode] = useState<'extract' | 'arithmetic'>('extract');
  const [name, setName] = useState('');
  const [sourceKey, setSourceKey] = useState('');
  const [pattern, setPattern] = useState('');
  const [type, setType] = useState<ColumnType>('string');
  const [left, setLeft] = useState('');
  const [op, setOp] = useState<ArithmeticOp>('/');
  const [right, setRight] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    !!name.trim() && (mode === 'extract' ? !!pattern : !!right.trim());

  // A right operand typed as a column name resolves to its key; else it's a
  // numeric literal, passed through as-is.
  const resolveOperand = (token: string) =>
    items.find((i) => i.name === token || i.key === token)?.key ?? token.trim();

  const submitDerived = () => {
    if (!onAddDerived || !name.trim()) return;
    if (mode === 'extract') {
      if (!pattern) return;
      try {
        new RegExp(pattern); // validate before committing
      } catch {
        setError('Invalid regular expression');
        return;
      }
      const src = sourceKey || items[0]?.key;
      if (!src) return;
      onAddDerived({ name: name.trim(), sourceKey: src, pattern, type });
    } else {
      if (!right.trim()) return;
      onAddDerived({
        kind: 'arithmetic',
        name: name.trim(),
        left: left || items[0]?.key || '',
        op,
        right: resolveOperand(right),
        type: type === 'string' ? 'number' : type,
      });
    }
    setName('');
    setPattern('');
    setRight('');
    setError(null);
  };

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const visibleCount = items.filter((i) => i.visible).length;
  const lastVisible = visibleCount <= 1;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={btnSecondary}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-slate-400 dark:text-slate-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        Columns
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {visibleCount}/{items.length}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-1 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="max-h-72 overflow-auto">
            {items.map((item, idx) => (
              <div
                key={item.key}
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <label className="flex flex-1 items-center gap-2 truncate text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={item.visible}
                    disabled={item.visible && lastVisible}
                    onChange={() => onToggle(item.key)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/30 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-700"
                  />
                  <span className="truncate">{item.name}</span>
                </label>
                {onRetype && (
                  <select
                    aria-label={`Type of ${item.name}`}
                    value={item.type}
                    onChange={(e) => onRetype(item.key, e.target.value as ColumnType)}
                    className="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs text-slate-500 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                  >
                    {COLUMN_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => onMove(item.key, 'up')}
                  disabled={idx === 0}
                  aria-label={`Move ${item.name} up`}
                  className={moveBtnCls}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onMove(item.key, 'down')}
                  disabled={idx === items.length - 1}
                  aria-label={`Move ${item.name} down`}
                  className={moveBtnCls}
                >
                  ↓
                </button>
                {item.derived && onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(item.key)}
                    aria-label={`Remove ${item.name}`}
                    className={`${moveBtnCls} hover:!bg-red-50 hover:!text-red-600 dark:hover:!bg-red-950/40`}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {onAddDerived && (
            <div className="mt-1 space-y-1.5 border-t border-slate-100 px-2 pt-2 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Add computed column
              </p>
              <div
                role="radiogroup"
                aria-label="Computed column mode"
                className="inline-flex rounded border border-slate-200 p-0.5 text-xs dark:border-slate-700"
              >
                {(['extract', 'arithmetic'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    onClick={() => {
                      setMode(m);
                      setError(null);
                    }}
                    className={
                      mode === m
                        ? 'rounded bg-brand-600 px-2 py-0.5 font-medium text-white'
                        : 'rounded px-2 py-0.5 text-slate-500 dark:text-slate-400'
                    }
                  >
                    {m === 'extract' ? 'Regex extract' : 'Math'}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name"
                  aria-label="New column name"
                  className="w-24 rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
                {mode === 'extract' && (
                  <select
                    value={sourceKey || items[0]?.key || ''}
                    onChange={(e) => setSourceKey(e.target.value)}
                    aria-label="Source column"
                    className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-1 py-1 text-xs text-slate-500 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                  >
                    {items.map((it) => (
                      <option key={it.key} value={it.key}>
                        {it.name}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ColumnType)}
                  aria-label="New column type"
                  className="rounded border border-slate-200 bg-white px-1 py-1 text-xs text-slate-500 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                >
                  {COLUMN_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {mode === 'extract' ? (
                <div className="flex gap-1.5">
                  <input
                    value={pattern}
                    onChange={(e) => {
                      setPattern(e.target.value);
                      setError(null);
                    }}
                    placeholder="Regex with (capture group)"
                    aria-label="Extraction regex"
                    className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-1.5 py-1 font-mono text-xs text-slate-700 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={submitDerived}
                    disabled={!canSubmit}
                    className={`${btnSecondary} disabled:opacity-40`}
                  >
                    Add
                  </button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <select
                    value={left || items[0]?.key || ''}
                    onChange={(e) => setLeft(e.target.value)}
                    aria-label="Left operand"
                    className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-1 py-1 text-xs text-slate-500 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                  >
                    {items.map((it) => (
                      <option key={it.key} value={it.key}>
                        {it.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={op}
                    onChange={(e) => setOp(e.target.value as ArithmeticOp)}
                    aria-label="Operator"
                    className="rounded border border-slate-200 bg-white px-1 py-1 text-xs text-slate-600 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {(['+', '-', '*', '/'] as const).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  <input
                    value={right}
                    onChange={(e) => setRight(e.target.value)}
                    placeholder="column or number"
                    aria-label="Right operand"
                    className="w-24 rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={submitDerived}
                    disabled={!canSubmit}
                    className={`${btnSecondary} disabled:opacity-40`}
                  >
                    Add
                  </button>
                </div>
              )}
              {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
            </div>
          )}

          <div className="mt-1 flex items-center justify-between border-t border-slate-100 px-2 pt-2 dark:border-slate-800">
            <button
              type="button"
              onClick={onShowAll}
              className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              Show all
            </button>
            <button
              type="button"
              onClick={onReset}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Reset order
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
