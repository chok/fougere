/**
 * The row inside what an operation answers — the page reads rows whether the op returns a list,
 * a page or a single one, so `items` is typed off this rather than off the whole answer.
 */
export type Rows<Answered> = Answered extends readonly (infer Row)[] ? Row
  : Answered extends { items: readonly (infer Row)[] } ? Row
  : Answered;
