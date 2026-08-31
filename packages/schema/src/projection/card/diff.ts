import type { BoundaryRef } from '../../schema/axis/boundary/Boundary.js';
import type { LifecycleRules } from '../../schema/axis/lifecycle/Lifecycle.js';
import type { FieldDescriptor, RoleDescriptor } from './Descriptor.js';

/** One named difference, at one place. Each kind exists because a reader asks for it. */
export type Change =
  /** DDL: add the column. Codec: the old caller never sends it. Boot: refuse when required. */
  | { kind: 'added'; field: string; to: FieldDescriptor; required: boolean }
  /** DDL: drop the column. Codec: the old caller still sends it, and it goes nowhere. */
  | { kind: 'removed'; field: string; from: FieldDescriptor; required: boolean }
  /** DDL: rename the column. Codec and ORM: one more entry in the field-to-column map. */
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

/** A field's declared types, always represented as a set. */
export type TypeSet = string[];

/** A removal and an addition that could be one rename: same shape, different name. */
export interface RenameCandidate {
  removed: string;
  added: string;
}

export interface Diff {
  changes: Change[];
  /** Questions the comparison refuses to decide without an explicit rename declaration. */
  ambiguous: RenameCandidate[];
}

export interface DiffOptions {
  /** Renames as declared at the time: old name to new name. */
  renamed?: Record<string, string>;
}

export interface SetDiff {
  /** Entities the target bundle has and the source bundle had not. */
  entitiesAdded: string[];
  /** Entities the source bundle had and the target bundle has not. */
  entitiesRemoved: string[];
  /** Differences for entities present in both bundles; unchanged entities are absent. */
  entities: Record<string, Diff>;
}

export interface SetDiffOptions {
  /** Declared renames, per entity: `{ post: { body: 'content' } }`. */
  renamed?: Record<string, Record<string, string>>;
}
