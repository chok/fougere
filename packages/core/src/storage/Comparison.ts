import { type Field, Shapes } from '@fougere/schema';

/** The comparisons a criterion may name, besides equality and membership. */
export interface Comparison {
  gte?: unknown;
  lte?: unknown;
  gt?: unknown;
  lt?: unknown;
  ne?: unknown;
  /** Both bounds, inclusive — `between: [1500, 4000]`. */
  between?: [unknown, unknown];
  contains?: string;
  notIn?: readonly unknown[];
  isNull?: boolean;
}

export type ComparisonName = keyof Comparison;

export const COMPARISONS = Object.keys({
  gte: true, lte: true, gt: true, lt: true, ne: true, between: true, contains: true, notIn: true, isNull: true,
} satisfies Record<ComparisonName, true>);

/** Whether a criterion is a comparison, read off the field rather than the value. */
export function comparisonOf(field: Field | undefined, asked: unknown): Comparison | undefined {
  if (asked === null || typeof asked !== 'object' || Array.isArray(asked)) return undefined;
  if (!field || Shapes.typeOf(field.shape) === 'object') return undefined;

  return asked as Comparison;
}

/** The comparisons a criterion names, in the order the caller wrote them. */
export function comparisonsIn(comparison: Comparison): [ComparisonName, unknown][] {
  return Object.entries(comparison).filter(
    (entry): entry is [ComparisonName, unknown] => COMPARISONS.includes(entry[0]),
  );
}

/** What a comparison names that this vocabulary does not — a typo, said as one. */
export function unknownIn(comparison: Comparison): string[] {
  return Object.keys(comparison).filter((name) => !COMPARISONS.includes(name));
}
