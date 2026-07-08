import type { ColumnType } from '@/types/dataset';
import type { FilterOperator, OperatorMeta } from '@/types/filter';

/** Catalogue of every filter operator and the column types it applies to. */
export const OPERATORS: OperatorMeta[] = [
  { value: 'contains', label: 'filter.op.contains', arity: 1, types: ['string', 'date'] },
  { value: 'notContains', label: 'filter.op.notContains', arity: 1, types: ['string', 'date'] },
  { value: 'equals', label: 'filter.op.equals', arity: 1, types: ['string', 'number', 'date'] },
  { value: 'notEquals', label: 'filter.op.notEquals', arity: 1, types: ['string', 'number', 'date'] },
  { value: 'gt', label: 'filter.op.gt', arity: 1, types: ['number', 'date'] },
  { value: 'gte', label: 'filter.op.gte', arity: 1, types: ['number', 'date'] },
  { value: 'lt', label: 'filter.op.lt', arity: 1, types: ['number', 'date'] },
  { value: 'lte', label: 'filter.op.lte', arity: 1, types: ['number', 'date'] },
  { value: 'between', label: 'filter.op.between', arity: 2, types: ['number', 'date'] },
  { value: 'isTrue', label: 'filter.op.isTrue', arity: 0, types: ['boolean'] },
  { value: 'isFalse', label: 'filter.op.isFalse', arity: 0, types: ['boolean'] },
  {
    value: 'isEmpty',
    label: 'filter.op.isEmpty',
    arity: 0,
    types: ['string', 'number', 'boolean', 'date'],
  },
  {
    value: 'isNotEmpty',
    label: 'filter.op.isNotEmpty',
    arity: 0,
    types: ['string', 'number', 'boolean', 'date'],
  },
];

const BY_VALUE = new Map<FilterOperator, OperatorMeta>(
  OPERATORS.map((op) => [op.value, op]),
);

export function getOperator(value: FilterOperator): OperatorMeta | undefined {
  return BY_VALUE.get(value);
}

export function operatorsForType(type: ColumnType): OperatorMeta[] {
  return OPERATORS.filter((op) => op.types.includes(type));
}
