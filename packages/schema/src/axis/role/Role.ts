// ─── Axis 2 · role — identity, relations, and what the storage realizes ────
// `unique` and `index` are the only axis members realized OUTSIDE the framework — the DDL
// emits them and the database enforces them, so a collision surfaces as the driver's error,
// never as a `validate()` failure.

import type { FieldGroup } from './FieldGroup.js';
import type { Relation } from './Relation.js';

export interface Role {
  primary?: boolean;
  index?: boolean;
  relation?: Relation;
  /**
   * Every {@link FieldGroup} that names this field, of whatever kind — one list, so a new
   * kind is a subclass and this type does not move. `index` is still a bare boolean: a rule
   * of the same family that cannot yet name several fields.
   */
  rules?: ReadonlyArray<FieldGroup>;
}

