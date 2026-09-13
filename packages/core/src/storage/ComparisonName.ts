export const COMPARISONS = ['gte', 'lte', 'gt', 'lt', 'ne', 'between', 'contains', 'notIn', 'isNull'] as const;

export type ComparisonName = (typeof COMPARISONS)[number];
