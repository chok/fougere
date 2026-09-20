import type { Shape } from '../../axis/shape/Shape.js';
import type { UnionToIntersection } from '../../lib/UnionToIntersection.js';

type KeywordsOf<S> = S extends unknown ? Partial<Omit<S, 'type' | 'items' | 'properties'>> : never;

/** Every keyword any shape may carry, flattened — what a descriptor records of one. */
export type ShapeKeywords = UnionToIntersection<KeywordsOf<Shape>>;
