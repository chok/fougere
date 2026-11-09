/** The row inside what an operation answers: a list, a page or a single row. */
export type Rows<Answered> = Answered extends readonly (infer Row)[] ? Row
  : Answered extends { items: readonly (infer Row)[] } ? Row
  : Answered;
