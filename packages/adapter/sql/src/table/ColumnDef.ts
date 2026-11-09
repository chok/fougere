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
   * What the shape bounds beyond its type, realized as a `CHECK`.
   * Ex: `oneOf`, `min`, `max`.
   */
  bounds?: ShapeBounds;
  /** The values are UUIDs, stored in 16 bytes by an engine with a `uuid` type. */
  uuid?: boolean;
  /** The FK target, from `role.relation` when it's a `ref()` (kind `'one'`). */
  references?: ColumnReference;
  /** What the entity stated for this adapter. */
  stated?: SqlField;
}
