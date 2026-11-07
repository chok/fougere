/** A union turned into an intersection: `A | B` → `A & B`. */
export type UnionToIntersection<U> = (U extends unknown ? (member: U) => void : never) extends (
  member: infer Held,
) => void
  ? Held
  : never;
