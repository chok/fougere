import type { OnDelete } from '@fougere/schema';

/**
 * A `ref()` read from the TARGET's side: rows that name it, and what becomes of them.
 *
 * Documented: [entities](https://fougere.dev/docs/concepts/entity).
 */
export interface Dependent {
  /** The entity whose rows name the target — `post`. */
  entity: string;
  /** The field carrying the key — `authorId`. */
  field: string;
  /** Unstated is `restrict`: what a foreign key does when nothing is said. */
  onDelete: OnDelete;
}
