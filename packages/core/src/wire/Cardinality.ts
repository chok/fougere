/** How MUCH an operation answers — the half of a return type that a view cannot say. */
export const CARDINALITIES = ['one', 'maybe', 'many', 'page', 'none'] as const;

export type Cardinality = (typeof CARDINALITIES)[number];
