/**
 * What a union becomes when every member must hold at once — `A | B` → `A & B`, through the
 * contravariance of a parameter position, which is the only place TypeScript folds a union.
 * `Merged<[Post, Draft]>` and `ShapeKeywords` both need it, and each had written it out.
 */
export type UnionToIntersection<U> = (U extends unknown ? (member: U) => void : never) extends (
  member: infer Held,
) => void
  ? Held
  : never;
