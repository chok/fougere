import type { Shape } from '../../axis/shape/Shape.js';

type KeywordsOf<S> = S extends unknown ? Partial<Omit<S, 'type' | 'items' | 'properties'>> : never;
type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

/** Every keyword any shape may carry, flattened — what a descriptor records of one. */
export type ShapeKeywords = UnionToIntersection<KeywordsOf<Shape>>;
