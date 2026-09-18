import type { BoundaryRef } from '../../axis/boundary/Boundary.js';
import type { LifecycleRules } from '../../axis/lifecycle/Lifecycle.js';
import type { FieldDescriptor } from './FieldDescriptor.js';
import type { RoleDescriptor } from './RoleDescriptor.js';
import type { TypeSet } from './TypeSet.js';

/** One named difference, at one place. Each kind exists because a reader asks for it. */
export type Change =
  /** DDL: add the column. Codec: the old caller never sends it. Boot: refuse when required. */
  | { kind: 'added'; field: string; to: FieldDescriptor; required: boolean }
  /** DDL: drop the column. Codec: the old caller still sends it, and it goes nowhere. */
  | { kind: 'removed'; field: string; from: FieldDescriptor; required: boolean }
  /** DDL: rename the column. Codec and storage: one more entry in the field-to-column map. */
  | { kind: 'renamed'; from: string; to: string; field: FieldDescriptor }
  /** DDL: alter the type. Codec: convert the value, when it can. */
  | { kind: 'retyped'; field: string; from: TypeSet; to: TypeSet }
  /** Same type, different bounds: a CHECK moves, and a value legal yesterday may not be. */
  | { kind: 'reshaped'; field: string; from: FieldDescriptor; to: FieldDescriptor }
  /** NOT NULL in either direction. Boot: an old writer cannot fill what it never knew. */
  | { kind: 'required'; field: string; from: boolean; to: boolean }
  /** An axis other than shape was restated. */
  | { kind: 'restated'; field: string; axis: 'role'; from?: RoleDescriptor; to?: RoleDescriptor }
  | { kind: 'restated'; field: string; axis: 'lifecycle'; from?: LifecycleRules; to?: LifecycleRules }
  | { kind: 'restated'; field: string; axis: 'boundary'; from?: BoundaryRef; to?: BoundaryRef };
