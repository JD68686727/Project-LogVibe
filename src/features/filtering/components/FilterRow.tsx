import type { Dataset } from '@/types/dataset';
import type { ColumnFilter, FilterOperator } from '@/types/filter';
import { getOperator, operatorsForType } from '@/lib/filter/operators';
import { useI18n } from '@/lib/i18n/I18nContext';
import { selectCls } from '@/utils/controls';

const inputCls = `${selectCls} w-36`;

export interface FilterRowProps {
  dataset: Dataset;
  filter: ColumnFilter;
  onChange: (patch: Partial<ColumnFilter>) => void;
  onRemove: () => void;
}

/** Editor for a single column filter: column · operator · operand(s). */
export function FilterRow({ dataset, filter, onChange, onRemove }: FilterRowProps) {
  const { t } = useI18n();
  const colIdx = dataset.columnIndex[filter.columnKey];
  const column = dataset.columns[colIdx] ?? dataset.columns[0];
  const ops = operatorsForType(column.type);
  const arity = getOperator(filter.operator)?.arity ?? 1;

  const handleColumnChange = (key: string) => {
    const newCol = dataset.columns[dataset.columnIndex[key]];
    const validOps = operatorsForType(newCol.type);
    const keepOperator = validOps.some((o) => o.value === filter.operator);
    onChange({
      columnKey: key,
      operator: keepOperator ? filter.operator : validOps[0].value,
      value: '',
      value2: undefined,
    });
  };

  const handleOperatorChange = (operator: FilterOperator) => {
    const next: Partial<ColumnFilter> = { operator };
    if ((getOperator(operator)?.arity ?? 1) < 2) next.value2 = undefined;
    onChange(next);
  };

  const inputType = column.type === 'number' ? 'number' : 'text';
  const placeholder =
    column.type === 'date' ? 'YYYY-MM-DD' : t('filter.valuePlaceholder');

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900">
      <select
        aria-label={t('filter.column')}
        value={filter.columnKey}
        onChange={(e) => handleColumnChange(e.target.value)}
        className={selectCls}
      >
        {dataset.columns.map((c) => (
          <option key={c.key} value={c.key}>
            {c.name}
          </option>
        ))}
      </select>

      <select
        aria-label={t('filter.operator')}
        value={filter.operator}
        onChange={(e) => handleOperatorChange(e.target.value as FilterOperator)}
        className={selectCls}
      >
        {ops.map((o) => (
          <option key={o.value} value={o.value}>
            {t(o.label)}
          </option>
        ))}
      </select>

      {arity >= 1 && (
        <input
          type={inputType}
          aria-label={t('filter.value')}
          value={filter.value}
          placeholder={placeholder}
          onChange={(e) => onChange({ value: e.target.value })}
          className={inputCls}
        />
      )}

      {arity === 2 && (
        <>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {t('filter.and')}
          </span>
          <input
            type={inputType}
            aria-label={t('filter.value2')}
            value={filter.value2 ?? ''}
            placeholder={placeholder}
            onChange={(e) => onChange({ value2: e.target.value })}
            className={inputCls}
          />
        </>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={t('filter.removeFilter')}
        className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-500 dark:hover:bg-rose-500/15 dark:hover:text-rose-400"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
