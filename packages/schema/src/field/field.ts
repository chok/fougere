import type { Shape } from './shape.js';
import type { Role } from './role.js';
import type { Lifecycle } from './lifecycle.js';
import type { BoundaryRef } from './boundary.js';
import type { Meta } from './meta.js';

/**
 * A field — the single source of truth, decomposed on four orthogonal axes
 * plus one documentary compartment:
 * `shape` (is the value valid? — nullability included, as the `[T,'null']` union),
 * `role` (place in the entity graph), `lifecycle` (who writes the value, at which
 * moment), `boundary` (how a value crosses wire↔domain), `meta` (human-facing,
 * never decides). Adapters read the axes they care about; nothing reads all of
 * them at once. `boundary` is usually absent — its default is derived from
 * `shape` and the slot only overrides it.
 *
 * @typeParam T - the data type this field carries (phantom, TS inference only)
 * @typeParam A - "auto-supplied at creation" (primary/auto/default/optional) →
 *   the field is optional in `new X(input)`. Phantom, type-level only.
 */
export interface Field<T = unknown, A extends boolean = false> {
  readonly __brand: 'fougere_field';
  readonly shape?: Shape;
  readonly role?: Role;
  readonly lifecycle?: Lifecycle;
  readonly boundary?: BoundaryRef;
  readonly meta?: Meta;
  /** Phantom — data type, never read at runtime. */
  readonly _type?: T;
  /** Phantom — auto-at-creation flag, never read at runtime. */
  readonly _auto?: A;
}

/** Any field, regardless of its T/A parameters — the correct generic bound. */
export type AnyField = Field<any, boolean>;

/** A record of fields — the input to `entity()` and every derivation. */
export type Fields = Record<string, AnyField>;

export interface FieldInit {
  shape?: Shape;
  role?: Role;
  lifecycle?: Lifecycle;
  boundary?: BoundaryRef;
  meta?: Meta;
}

export function createField<T, A extends boolean = false>(init: FieldInit = {}): Field<T, A> {
  return {
    __brand: 'fougere_field',
    shape: init.shape,
    role: init.role,
    lifecycle: init.lifecycle,
    boundary: init.boundary,
    meta: init.meta,
  };
}

/**
 * Copy a field, overriding only the named axes — every OTHER axis is preserved.
 * This is the invariant every field transform must hold: change what you mean,
 * keep the rest. Enumerating axes by hand (the old `optional`/`primary`) silently
 * drops whatever axis was added last — `codec` did exactly that. Spread + override,
 * so a future 6th slot travels for free. (Spread props skip excess-property checks,
 * so the field's `__brand`/phantoms ride along harmlessly and `createField` resets them.)
 */
export function cloneField(field: AnyField, overrides: FieldInit = {}): AnyField {
  return createField({ ...field, ...overrides });
}

/** Duck type for anything with fields — Entity, SchemaConstructor. */
export interface SchemaLike {
  getFields(): Fields;
  /** The view's validation mode (patch…) — carried by SchemaConstructor, optional on bare wrappers. */
  getOpts?(): { patch?: boolean };
  /** Field groups unique together — carried by SchemaConstructor, absent on bare wrappers. */
  getUnique?(): ReadonlyArray<ReadonlyArray<string>> | undefined;
}

export function isField(value: unknown): value is AnyField {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__brand' in value &&
    (value as any).__brand === 'fougere_field'
  );
}
