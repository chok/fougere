import type { BoundaryRef } from '../../axis/boundary/Boundary.js';
import type { LifecycleRules } from '../../axis/lifecycle/Lifecycle.js';
import { dequal } from 'dequal';
import { EXTENSION_SLOTS } from '../../axis/Axis.js';
import type { FieldDescriptor, FieldExtension, RoleDescriptor, SchemaDescriptor } from './Descriptor.js';

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

/**
 * What changed between two descriptions of the same entity, read from the wire form alone.
 * FR : ce qui a changé entre deux descriptions d'une même entité, lu du seul format du fil.
 * `compare(v1, v2, { renamed: { body: 'content' } })` → one `renamed`, no `ambiguous`
 *
 * Documented: [how a schema moves](https://fougere.dev/docs/schema/evolution).
 */
export function compare(
  was: SchemaDescriptor,
  is: SchemaDescriptor,
  options: DiffOptions = {},
): Diff {
  const changes: Change[] = [];
  const renamed = options.renamed ?? {};
  const before = was.properties ?? {};
  const after = is.properties ?? {};
  const requiredBefore = new Set(was.required ?? []);
  const requiredAfter = new Set(is.required ?? []);

  // Apply a declared rename first so subsequent differences use the new field name.
  const nameAfter = (field: string): string => renamed[field] ?? field;
  const removed: string[] = [];
  for (const [field, descriptor] of Object.entries(before)) {
    const now = nameAfter(field);
    const target = after[now];
    if (target === undefined) {
      removed.push(field);
      continue;
    }

    if (now !== field)
      changes.push({ kind: 'renamed', from: field, to: now, field: target });

    const wasType = typesOf(descriptor);
    const isType = typesOf(target);
    if (!dequal(wasType, isType))
      changes.push({ kind: 'retyped', field: now, from: wasType, to: isType });
    else if (!dequal(boundsOf(descriptor), boundsOf(target))) {
      changes.push({ kind: 'reshaped', field: now, from: descriptor, to: target });
    }

    const wasRequired = requiredBefore.has(field);
    const isRequired = requiredAfter.has(now);
    if (wasRequired !== isRequired) {
      changes.push({ kind: 'required', field: now, from: wasRequired, to: isRequired });
    }
    changes.push(...restated(now, descriptor['x-fougere'], target['x-fougere']));
  }

  const claimed = new Set(Object.values(renamed));
  const added = Object.keys(after).filter(
    (field) => !(field in before) && !claimed.has(field),
  );
  for (const field of removed) {
    changes.push({
      kind: 'removed',
      field,
      from: before[field],
      required: requiredBefore.has(field),
    });
  }
  for (const field of added) {
    changes.push({
      kind: 'added',
      field,
      to: after[field],
      required: requiredAfter.has(field),
    });
  }

  return { changes, ambiguous: candidates(removed, added, before, after) };
}

function restated(
  field: string,
  before: FieldExtension | undefined,
  after: FieldExtension | undefined,
): Change[] {
  return EXTENSION_SLOTS.filter((axis) => !dequal(before?.[axis], after?.[axis])).map(
    (axis) =>
      ({
        kind: 'restated',
        field,
        axis,
        from: before?.[axis],
        to: after?.[axis],
      }) as Change,
  );
}

function shapeOf(descriptor: FieldDescriptor): Record<string, unknown> {
  const { 'x-fougere': _extension, description: _description, ...shape } = descriptor;
  return shape as Record<string, unknown>;
}

/**
 * Sorted, so `['string','null']` and `['null','string']` compare equal, not as a change.
 * FR : trié, pour que `['string','null']` et `['null','string']` soient égaux.
 * `typesOf({ type: ['null', 'string'] })` → `['null', 'string']`
 */
function typesOf(descriptor: FieldDescriptor): TypeSet {
  const type = descriptor.type;
  if (type === undefined) return [];
  return (Array.isArray(type) ? [...type] : [type]).sort();
}

/**
 * The shape without its type, which is what tells a `reshaped` from a `retyped`.
 * FR : la forme sans son type, ce qui distingue un `reshaped` d'un `retyped`.
 * `maxLength: 200` → `maxLength: 100` → one `reshaped`, never a `retyped`
 */
function boundsOf(descriptor: FieldDescriptor): Record<string, unknown> {
  const { type: _type, ...rest } = shapeOf(descriptor);
  return rest;
}

/**
 * A removal plus an addition of one shape is REPORTED, never resolved — only `renamed` decides.
 * FR : une suppression plus un ajout de même forme est RAPPORTÉE, jamais résolue.
 * `body` gone, `content` appeared → `ambiguous: [{ removed: 'body', added: 'content' }]`
 */
function candidates(
  removed: string[],
  added: string[],
  before: Record<string, FieldDescriptor>,
  after: Record<string, FieldDescriptor>,
): RenameCandidate[] {
  const found: RenameCandidate[] = [];
  for (const gone of removed) {
    for (const appeared of added) {
      if (dequal(shapeOf(before[gone]), shapeOf(after[appeared])))
        found.push({ removed: gone, added: appeared });
    }
  }
  const was = Object.keys(before);
  const now = Object.keys(after);
  const apart = ({ removed: gone, added: appeared }: RenameCandidate): number =>
    Math.abs(now.indexOf(appeared) - was.indexOf(gone));
  return found.sort((a, b) => apart(a) - apart(b));
}
