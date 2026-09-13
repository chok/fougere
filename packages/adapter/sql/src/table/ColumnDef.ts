import { type ShapeType } from '@fougere/schema';
import { type ShapeBounds } from '../check.js';
import { type SqlField } from '../fields/SqlField.js';
import type { ColumnReference } from './ColumnReference.js';

/** One column, described by the axes — plus, at most, what the entity stated for sql. */
export interface ColumnDef {
  /** Field key on the entity. */
  field: string;
  /** SQL column name (snake_case). */
  name: string;
  /** What every projection here dispatches on — a `date()` and a bounded set included. */
  type?: ShapeType;
  nullable: boolean;
  primary: boolean;
  /** A literal default (`lifecycle.create.value`), when the field declares one. */
  default?: unknown;
  /** A {@link Unique} of one — realized as a column constraint the database enforces. */
  unique?: boolean;
  /** `role.index` — realized as a separate `CREATE INDEX`, never a constraint. */
  index?: boolean;
  /**
   * What the shape bounds beyond its type — `oneOf`, `min`, `max`. Realized as a
   * `CHECK`, so the rule holds on every write and not only at the façade.
   */
  bounds?: ShapeBounds;
  /** The FK target, from `role.relation` when it's a `ref()` (kind `'one'`). */
  references?: ColumnReference;
  /**
   * What the entity stated for THIS adapter — never an axis. It says how the column is
   * realized here; drop it and the column is still describable.
   */
  stated?: SqlField;
}
