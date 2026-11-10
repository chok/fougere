/**
 * A `ref()` whose target the source does not hold, so the guard reads it before the write.
 *
 * Documented: [entities](https://fougere.dev/docs/concepts/entity).
 */
export interface RelationCheck {
  /** The field carrying the key — `authorId`. */
  field: string;
  /** What it points at, as the boot files it — `user`. */
  target: string;
  /** True when the target's rows are in another source than the namer's. */
  inAnotherSource: boolean;
  /** True when the namer's source keeps a mark for the target, which a release then waits on. */
  marked: boolean;
  /** Which of these keys no row answers. */
  missing(keys: readonly unknown[]): Promise<readonly unknown[]>;
}
