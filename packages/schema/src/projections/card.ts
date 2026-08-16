import type { BoundaryRef, LifecycleRules, Relation, Role, Shape } from '../field/index.js';

/**
 * The portable schema descriptor — an entity's "carte d'identité".
 *
 * A JSON Schema document: the `shape` axis at the top level, the three axes JSON Schema
 * cannot express under one `x-fougere` key per field. The normal forms ARE the wire form —
 * lifecycle and boundary travel verbatim, no descriptor twin to maintain.
 *
 * What cannot travel becomes a NAME, re-resolved against the consumer's registry: a
 * relation's thunk, a custom generator, a boundary codec.
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
 * A shape's constraint keywords, all optional and flattened — the union's branches merged.
 * `type` is NOT here: intersecting the branches would make the discriminant impossible,
 * and the wire genuinely allows a form memory never produces (see below).
 */
type ShapeKeywords = UnionToIntersection<KeywordsOf<Shape>>;

// The naked parameter is what distributes: `Omit<Shape, …>` on the union itself collapses
// to the common keys, since `keyof (A | B)` is the intersection.
type KeywordsOf<S> = S extends unknown ? Partial<Omit<S, 'type' | 'items' | 'properties'>> : never;
type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

/**
 * One field as a JSON Schema property. The shape keywords sit at the top level
 * (so an external JSON Schema tool reads them directly); the Fougère-only axes
 * live under `x-fougere`. A nullable field folds into the union `type: ['T','null']`.
 */
export type FieldDescriptor = ShapeKeywords & {
  /**
   * WIDER than `Shape`, which only ever emits `T` or the canonical `[T,'null']` tuple.
   * A card can come from another language, so the door judges the form; `reconstruct`
   * refuses what it cannot represent rather than pretending it read it.
   */
  type?: JsonSchemaType | JsonSchemaType[];
  /** A value list's element shape (`list(text())`). A bare `many` relation has none. */
  items?: FieldDescriptor;
  /** An embedded value object (`json(Entity)`): the nested shape-only properties. */
  properties?: Record<string, FieldDescriptor>;
  /** JSON Schema standard keyword — mirrors the field's `description`. */
  description?: string;
  'x-fougere'?: FieldExtension;
};

/** The three axes JSON Schema can't express, namespaced under a field's `x-fougere`. */
export interface FieldExtension {
  role?: RoleDescriptor;
  /** The normal form travels verbatim — named tokens, pure JSON. */
  lifecycle?: LifecycleRules;
  boundary?: BoundaryRef;
}

/**
 * The role, with its one unportable member replaced: `unique` names its members on the
 * wire, where in memory a lone `unique()` holds `[]` — a field does not know its own key,
 * a reader of the card must not have to guess it.
 *
 * Names what it KEEPS, like `describeRole` and `reconstructRole` do. Two of the four
 * members do not travel as they are, so portability is not the default a new one gets.
 */
export type RoleDescriptor = Pick<Role, 'primary' | 'index'> & {
  unique?: string[][];
  relation?: RelationDescriptor;
};

/** The relation, with its thunk replaced: the target is a NAME. */
export type RelationDescriptor = Pick<Relation, 'kind' | 'onDelete'> & { to: string };

/**
 * A whole entity as a JSON Schema object document. `version`/`vendor` mirror Standard
 * Schema's own (versioned + vendored), under `x-` extension keywords so the document
 * stays a valid JSON Schema for external tooling.
 */
export interface SchemaDescriptor {
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
 * A self-contained set of entity cards. Every entity lives under `$defs`, keyed by name,
 * and a relation's `to` is that key — a pointer, never an inlined sub-schema, so
 * `Post → Author → Post` is two references and not infinite nesting.
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
