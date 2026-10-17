import type { OnDelete } from '@fougere/schema';

/**
 * A `ref()` read from the TARGET's side: rows that name it, and what becomes of them.
 *
 * The dual of `RelationCheck`, which reads the same declaration from the child's side to judge
 * a write. Only what no foreign key holds reaches here — a key answers at the rows, inside the
 * delete's own transaction, and nothing in this process would see it happen.
 *
 * Documented: [entities](https://fougere.dev/docs/schema/entities).
 */
export interface Dependent {
  /** The entity whose rows name the target — `post`. */
  entity: string;
  /** The field carrying the key — `authorId`. */
  field: string;
  /** Unstated is `restrict`: what a foreign key does when nothing is said. */
  onDelete: OnDelete;
}
