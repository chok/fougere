import type { BoundaryRef, Lifecycle } from '../field/index.js';

/**
 * The portable schema descriptor — Fougère's "carte d'identité" of an entity.
 *
 * It is a JSON Schema document (the `shape` axis, a near-identity projection now
 * that {@link FieldDescriptor} already speaks JSON Schema) carrying the three axes JSON
 * Schema cannot express under a single `x-fougere` extension key per field: `role`
 * (identity/relations), `lifecycle` (write rules), `boundary` (wire↔domain).
 * The normal forms (named tokens, pure JSON) ARE the wire form — lifecycle and
 * boundary travel verbatim, no descriptor twin to maintain.
 *
 * It is the structural counterpart of Standard Schema (`~standard`): where
 * `~standard` is the live, opaque "I can validate" interface, the descriptor is the
 * transparent, serialisable description that crosses the wire. `describe()` produces
 * it; a single `reconstruct()` reads it back into a working schema (validate + from).
 *
 * Honest losses vs the live field map — a reference becomes a name, a live function
 * does not travel:
 * - `role.relation.to` (a `() => Entity` thunk) → {@link RelationDescriptor.to}, a name.
 * - a custom generator or boundary decoder/encoder travels by NAME, re-resolved
 *   against the consumer's registry ("unknown generator/alias" is loud and local).
 */

/** JSON Schema's `type` values, plus `null` for the nullable union form. */
export type JsonSchemaType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'null';

/**
 * One field as a JSON Schema property. The shape keywords sit at the top level
 * (so an external JSON Schema tool reads them directly); the Fougère-only axes
 * live under `x-fougere`. A nullable field folds into the union `type: ['T','null']`.
 */
export interface FieldDescriptor {
  type?: JsonSchemaType | JsonSchemaType[];
  /** JSON Schema format predicate (`date-time` for a date value, email, uuid, uri…). */
  format?: 'date-time' | 'date' | 'time' | 'email' | 'uuid' | 'uri';
  enum?: readonly (string | null)[];
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  /** A value list's element shape (`list(text())`). A bare `many` relation has none. */
  items?: FieldDescriptor;
  minItems?: number;
  maxItems?: number;
  /** An embedded value object (`json(Entity)`): the nested shape-only properties. */
  properties?: Record<string, FieldDescriptor>;
  /** The embedded object's required keys (JSON Schema nesting, travels verbatim). */
  required?: readonly string[];
  /** JSON Schema standard keyword — mirrors the field's `description`. */
  description?: string;
  'x-fougere'?: FieldExtension;
}

/** The three axes JSON Schema can't express, namespaced under a field's `x-fougere`. */
export interface FieldExtension {
  role?: RoleDescriptor;
  /** The normal form travels verbatim — named tokens, pure JSON. */
  lifecycle?: Lifecycle;
  boundary?: BoundaryRef;
}

export interface RoleDescriptor {
  primary?: boolean;
  /**
   * The unique constraints this field is a member of — one member list each, member
   * names spelled out. `[["slug"]]` is unique on its own; `[["listId","docId"]]` on both
   * members says the pair is unique together, which is the fact a foreign consumer could
   * not read before: the card carried one boolean per field and the pair vanished.
   *
   * Self-reference is resolved on the way out (a lone `unique()` holds `[]` in memory,
   * because a field does not know its own key) — a card always names its members, so a
   * reader never has to know which field a group hangs on.
   */
  unique?: string[][];
  index?: boolean;
  relation?: RelationDescriptor;
}

/** A relation as portable data: the target is a NAME, not a live entity thunk. */
export interface RelationDescriptor {
  to: string;
  kind: 'one' | 'many';
  onDelete?: 'cascade' | 'restrict' | 'set null';
}

/**
 * A whole entity as a JSON Schema object document. `version`/`vendor` mirror Standard
 * Schema's own (versioned + vendored), under `x-` extension keywords so the document
 * stays a valid JSON Schema for external tooling.
 */
export interface SchemaDescriptor {
  /** The entity name. */
  title?: string;
  type: 'object';
  properties: Record<string, FieldDescriptor>;
  /**
   * Create-time semantics: the names a caller MUST supply — no `lifecycle.create`
   * rule answers absence (nor a `many` relation, absent → `[]`). Presence only:
   * a nullable-but-required field IS listed (supply `null`, don't omit the key).
   * Narrower than JSON Schema's context-free `required`: it answers "what must a
   * creation payload carry?", not "what is always present when read?".
   */
  required?: string[];
  'x-fougere-version': 1;
  'x-fougere-vendor': 'fougere';
}

/**
 * A self-contained set of entity cards — a JSON Schema bundle. Every entity lives
 * under `$defs`, keyed by name; a relation's `to` is that name — the `$ref` into
 * `$defs`. The document is portable AND circular-safe: a relation is a pointer, never
 * an inlined sub-schema, so `Post → Author → Post` is two references, not infinite
 * nesting. `reconstructSet` resolves those `$ref`s so a synced relation hands back the
 * real reconstructed target (it feeds adapters), not just a name.
 */
export interface SchemaBundle {
  $defs: Record<string, SchemaDescriptor>;
  'x-fougere-version': 1;
  'x-fougere-vendor': 'fougere';
}

/** Drop keys whose value is `undefined`, so the descriptor stays clean JSON. */
export function clean<T extends Record<string, unknown>>(obj: T): T {
  for (const key of Object.keys(obj)) if (obj[key] === undefined) delete obj[key];
  return obj;
}
