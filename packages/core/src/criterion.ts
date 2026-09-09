/** What a read may ask about one field, and how a storage tells the two forms apart. */
import { type Field, Shapes } from '@fougere/schema';

/**
 * The comparisons a criterion may name.
 *
 * `eq` and `in` are not here: a bare value already means equality and an array already
 * means membership, and giving them a second spelling would make one criterion sayable
 * two ways. What is added is what those two could not say at all.
 */
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

export const COMPARISONS = ['gte', 'lte', 'gt', 'lt', 'ne', 'between', 'contains', 'notIn', 'isNull'] as const;

export type ComparisonName = (typeof COMPARISONS)[number];

/**
 * Is this criterion a comparison, or a value that happens to be an object?
 *
 * Read off the FIELD, never off the value. `json()` admits any shape, so `{ gte: … }` is
 * a legal thing to store — telling the two apart by looking at the criterion would make a
 * stored object unfilterable the day its keys happened to spell an operator. The shape
 * knows, and it is the only thing that does.
 */
export function comparisonOf(field: Field | undefined, asked: unknown): Comparison | undefined {
  if (asked === null || typeof asked !== 'object' || Array.isArray(asked)) return undefined;
  // The type is read off the base, so `optional(json())` still answers `object`.
  if (!field || Shapes.typeOf(field.shape) === 'object') return undefined;

  return asked as Comparison;
}

/** The comparisons a criterion names, in the order the caller wrote them. */
export function comparisonsIn(comparison: Comparison): [ComparisonName, unknown][] {
  return Object.entries(comparison).filter(
    (entry): entry is [ComparisonName, unknown] => (COMPARISONS as readonly string[]).includes(entry[0]),
  );
}

/** What a comparison names that this vocabulary does not — a typo, said as one. */
export function unknownIn(comparison: Comparison): string[] {
  return Object.keys(comparison).filter((name) => !(COMPARISONS as readonly string[]).includes(name));
}
