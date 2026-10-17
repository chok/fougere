/**
 * A `ref()` whose target the source does not hold, so the guard reads it before the write.
 *
 * The pair decides, never the engine: SQL keeps a foreign key over rows it can see, and a
 * target in another source gets a column and nothing else. The boot builds one of these for
 * each reference that falls outside its own source, and none for the rest — a co-located
 * relation costs nothing here, because the key already refuses the same row.
 *
 * Documented: [entities](https://fougere.dev/docs/schema/entities).
 */
export interface RelationCheck {
  /** The field carrying the key — `authorId`. */
  field: string;
  /** What it points at, as the boot files it — `user`. */
  target: string;
  /**
   * Which of these keys no row answers. Takes a set so a page costs one read, and so the
   * single-row case is the same call with one member.
   */
  missing(keys: readonly unknown[]): Promise<readonly unknown[]>;
}
