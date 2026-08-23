/**
 * What changed between two shapes — the one calculation three readers share.
 *
 * A DDL applies it ONCE to the rows (a migration), a codec applies it at EVERY call
 * (an old API version still being served), and a boot reads it to refuse a version that
 * can no longer produce a valid row. Writing it three times would let the three disagree
 * about the same two shapes.
 *
 * It knows no engine and no protocol: a `Change` is a fact about descriptors, and the
 * dialect stays where the dialect belongs.
 *
 * **It never guesses a rename.** A field gone plus a field appeared is either a rename or
 * a drop-and-add, and the two produce opposite DDL — one keeps the data, the other throws
 * it away. The intent lives in the transition and no pair of snapshots holds it, so it is
 * an input here (`renamed`) and what is left over is REPORTED rather than resolved.
 */
import type { BoundaryRef } from '../axis/boundary/Boundary.js';
import type { LifecycleRules } from '../axis/lifecycle/Lifecycle.js';
import type { FieldDescriptor, FieldExtension, RoleDescriptor, SchemaBundle, SchemaDescriptor } from './Descriptor.js';
import { same } from '../same.js';

/** One named difference, at one place. Each kind exists because a reader asks for it. */
export type Change =
  /** DDL: add the column. Codec: the old caller never sends it. Boot: refuse when required. */
  | { kind: 'added'; field: string; to: FieldDescriptor; required: boolean }
  /** DDL: drop the column. Codec: the old caller still sends it, and it goes nowhere. */
  | { kind: 'removed'; field: string; from: FieldDescriptor; required: boolean }
  /** DDL: rename the column. Codec and ORM: one more entry in the field→column map. */
  | { kind: 'renamed'; from: string; to: string; field: FieldDescriptor }
  /** DDL: alter the type. Codec: convert the value, when it can. */
  | { kind: 'retyped'; field: string; from: TypeSet; to: TypeSet }
  /** Same type, different bounds — a CHECK moves, and a value legal yesterday may not be. */
  | { kind: 'reshaped'; field: string; from: FieldDescriptor; to: FieldDescriptor }
  /** NOT NULL in either direction. Boot: an old writer cannot fill what it never knew. */
  | { kind: 'required'; field: string; from: boolean; to: boolean }
  /**
   * An axis other than shape was restated — `axis` names which, so a reader switches on
   * it rather than re-comparing the descriptor it was handed.
   *
   * One kind for three axes and three kinds for shape is not lopsided: shape is the half
   * a JSON Schema reader honours, and its differences mean different things to a table.
   * A field is FOUR axes, and a comparison that reads one of them answers a quarter of
   * the question — measured, and every reader of `diff` was blind the same way.
   */
  | { kind: 'restated'; field: string; axis: 'role'; from?: RoleDescriptor; to?: RoleDescriptor }
  | { kind: 'restated'; field: string; axis: 'lifecycle'; from?: LifecycleRules; to?: LifecycleRules }
  | { kind: 'restated'; field: string; axis: 'boundary'; from?: BoundaryRef; to?: BoundaryRef };

/** A field's declared type(s) — `describe` folds nullable into a union, so it is a set. */
export type TypeSet = string[];

/** A removal and an addition that could be one rename — same shape, different name. */
export interface RenameCandidate {
  removed: string;
  added: string;
}

export interface Diff {
  changes: Change[];
  /**
   * What the calculation refuses to decide. Empty means the answer is complete; anything
   * here has to be settled by whoever made the change, while they still remember.
   */
  ambiguous: RenameCandidate[];
}

export interface DiffOptions {
  /** Renames as declared at the time — old name → new name. */
  renamed?: Record<string, string>;
}

/** The three axes `shapeOf` sets aside, compared one by one. */
const AXES = ['role', 'lifecycle', 'boundary'] as const;

/**
 * What moved on the axes a JSON Schema reader cannot see.
 *
 * Compared as VALUES: every axis is normal-form data by construction — that is what makes
 * a descriptor travel — so equality is the whole test and no axis needs its own reader.
 */
function restated(field: string, before: FieldExtension | undefined, after: FieldExtension | undefined): Change[] {
  return AXES.filter((axis) => !same(before?.[axis], after?.[axis])).map(
    (axis) => ({ kind: 'restated', field, axis, from: before?.[axis], to: after?.[axis] }) as Change,
  );
}

/** The shape half of a descriptor: everything a JSON Schema reader would honour. */
function shapeOf(descriptor: FieldDescriptor): Record<string, unknown> {
  const { 'x-fougere': _extension, ...shape } = descriptor;
  return shape as Record<string, unknown>;
}

/** Its type, always as a set — `'string'` and `['string', 'null']` compare as sets. */
function typesOf(descriptor: FieldDescriptor): TypeSet {
  const type = descriptor.type;
  if (type === undefined) return [];
  return (Array.isArray(type) ? [...type] : [type]).sort();
}

/** Everything but the type — the bounds, the format, the value list. */
function boundsOf(descriptor: FieldDescriptor): Record<string, unknown> {
  const { type: _type, ...rest } = shapeOf(descriptor);
  return rest;
}


/**
 * What separates two shapes.
 *
 * `from` is the older one — a frozen version, or the state a migration starts at. The
 * changes read as instructions to get from it to `to`.
 */
export function diff(from: SchemaDescriptor, to: SchemaDescriptor, options: DiffOptions = {}): Diff {
  const changes: Change[] = [];
  const renamed = options.renamed ?? {};

  const before = from.properties ?? {};
  const after = to.properties ?? {};
  const requiredBefore = new Set(from.required ?? []);
  const requiredAfter = new Set(to.required ?? []);

  // A declared rename is applied FIRST: past this point the field is compared under its
  // new name, so a rename plus a type change reads as two changes and not as a
  // drop-and-add that happens to look alike.
  const nameAfter = (field: string): string => renamed[field] ?? field;

  const removed: string[] = [];
  for (const [field, descriptor] of Object.entries(before)) {
    const now = nameAfter(field);
    const target = after[now];

    if (target === undefined) {
      removed.push(field);
      continue;
    }

    if (now !== field) changes.push({ kind: 'renamed', from: field, to: now, field: target });

    const wasType = typesOf(descriptor);
    const isType = typesOf(target);
    if (!same(wasType, isType)) changes.push({ kind: 'retyped', field: now, from: wasType, to: isType });
    else if (!same(boundsOf(descriptor), boundsOf(target))) {
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
  const added = Object.keys(after).filter((field) => !(field in before) && !claimed.has(field));

  for (const field of removed) {
    changes.push({ kind: 'removed', field, from: before[field], required: requiredBefore.has(field) });
  }
  for (const field of added) {
    changes.push({ kind: 'added', field, to: after[field], required: requiredAfter.has(field) });
  }

  return { changes, ambiguous: candidates(removed, added, before, after) };
}

/**
 * Which removal could be which addition. Paired on an identical shape, because that is
 * the whole of what a snapshot knows: two fields carrying the same declaration under two
 * names is exactly what a rename leaves behind.
 *
 * Reported, never applied — including when there is only one pair. A confident guess is
 * still a guess, and being wrong here drops a column of live data.
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
      if (same(shapeOf(before[gone]), shapeOf(after[appeared]))) found.push({ removed: gone, added: appeared });
    }
  }

  // Nearest first: a rename usually leaves the field where it was, so the declaration's
  // own order ranks the pairs. It ORDERS them and decides nothing — the list is whole.
  const was = Object.keys(before);
  const now = Object.keys(after);
  const apart = ({ removed: gone, added: appeared }: RenameCandidate): number =>
    Math.abs(now.indexOf(appeared) - was.indexOf(gone));
  return found.sort((a, b) => apart(a) - apart(b));
}

/**
 * What separates two BUNDLES — the dual of `describeSet`, and the shape a freeze
 * actually compares: a version is a set of entities, not one.
 *
 * An entity that appeared or left is reported by name and nothing more. Renaming an
 * ENTITY is deliberately not modelled here: the field-level ambiguity has a declaration
 * to resolve it (`renamed`), and inventing a second one before anything asks would be
 * two mechanisms for one question.
 */
export interface SetDiff {
  /** Entities `to` has and `from` had not — a `createTable` for a migration. */
  entitiesAdded: string[];
  /** Entities `from` had and `to` has not. */
  entitiesRemoved: string[];
  /** Per entity present in both, when anything differs. An unchanged entity is absent. */
  entities: Record<string, Diff>;
}

export interface SetDiffOptions {
  /** Declared renames, per entity: `{ post: { body: 'content' } }`. */
  renamed?: Record<string, Record<string, string>>;
}

export function diffSet(from: SchemaBundle, to: SchemaBundle, options: SetDiffOptions = {}): SetDiff {
  const before = from.$defs ?? {};
  const after = to.$defs ?? {};
  const entities: Record<string, Diff> = {};

  for (const [name, descriptor] of Object.entries(before)) {
    const target = after[name];
    if (target === undefined) continue;
    const answer = diff(descriptor, target, { renamed: options.renamed?.[name] ?? {} });
    // An entity that did not move says nothing — a freeze records differences, not a census.
    if (answer.changes.length > 0 || answer.ambiguous.length > 0) entities[name] = answer;
  }

  return {
    entitiesAdded: Object.keys(after).filter((name) => !(name in before)),
    entitiesRemoved: Object.keys(before).filter((name) => !(name in after)),
    entities,
  };
}
