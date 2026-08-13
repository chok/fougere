import { isShape, type Shape } from "./shape.js";
import type { Role } from "./role.js";
import type { Lifecycle } from "./lifecycle.js";
import type { BoundaryRef } from "./boundary.js";
import type { Meta } from "./meta.js";

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
 */
export class Field<T = unknown> {
  /**
   * REQUIRED — a field always says what its value looks like. It was optional, and
   * the one field that had no shape (`many`) forced five readers to re-derive "what
   * kind of field is this" from its absence: the judge, `describe`, `reconstruct`,
   * `list`'s guard and the TS projection. A field with neither shape nor role was
   * legal, judged nothing, and became an invented `text not null` column in SQL.
   */
  readonly shape: Shape;
  readonly role?: Role;
  readonly lifecycle?: Lifecycle;
  readonly boundary?: BoundaryRef;
  readonly meta?: Meta;
  /** Phantom — data type, never read at runtime. `declare`: no slot, no emit. */
  declare readonly _type?: T;

  /**
   * Judges, then keeps the five slots — always the same five, whatever was passed in.
   * So `new Field(x)` on anything field-shaped answers a canonical field, and on
   * anything else refuses: there is no other way to obtain one, which is what lets
   * every reader downstream stop asking where a field came from.
   *
   * The refusal lives HERE and not in the caller's loop, because `new Field({})` is
   * reachable without a compiler in front of it — plain JS, a `fougere.config.ts`, a
   * card another language wrote. A check outside would have left that door open while
   * looking closed.
   *
   * `key` is the only thing a caller knows that a field does not: the name it is filed
   * under. It is a label for the message and is never stored — a field has no name of its
   * own, the map does. Passing it is what makes the refusal read `Field 'vide': not a
   * field` instead of leaving the author to hunt through twenty entries.
   *
   * Where a plain object stands, exactly: the RUNTIME takes one — {@link isField} reads
   * the shape and never the constructor, so foreign data gets in and comes out canonical.
   * TypeScript does NOT: `with` is a member, and an object literal has no `with`, so
   * `entity({ t: { shape } })` is a type error where the same call succeeds from JS. That
   * asymmetry is the method's price, and it is the affordable half — the untyped callers
   * are the ones no compiler was going to serve, and a TS caller has the vocabulary.
   * (No `private` member either, so nothing here is nominal: `instanceof` is never the
   * question asked of a field.)
   */
  /*
   * The five slots are assigned by NAME and not with `Object.assign(this, init)`, which
   * would be one line and would carry a 6th axis for free. Measured, on the very input
   * this door exists to accept — a card parsed from JSON, written by another language:
   * `Object.assign` copies through `[[Set]]`, so an own `__proto__` key fires the setter
   * and REPLACES the field's prototype. The field then has no `with`, and carries whatever
   * the sender put there. Naming the slots is immune, and drops anything else riding along.
   */
  constructor(init: FieldData, key?: string) {
    if (!isField(init)) {
      throw new Error(
        `${key ? `Field '${key}': ` : ''}not a field — got ${JSON.stringify(init)}. `
        + `Use the vocabulary (text(), number(), primary(), many()…); every field states a shape.`,
      );
    }
    this.shape = init.shape;
    this.role = init.role;
    this.lifecycle = init.lifecycle;
    this.boundary = init.boundary;
    this.meta = init.meta;
  }

  /**
   * Copy, overriding only the named axes — every OTHER axis is preserved. This is the
   * invariant every field transform must hold: change what you mean, keep the rest.
   * Enumerating axes by hand (the old `optional`/`primary`) silently drops whatever axis
   * was added last — `codec` did exactly that. Spread + override, so a future 6th slot
   * travels for free.
   *
   * `T` rides through by DEFAULT — an axis is not the data type, so the words that only
   * touch an axis name no type argument. The two that genuinely re-type say which:
   * `nullable` and `optional` widen to `T | null`. Stating it in the call is the point —
   * the alternative was `as unknown as Field<…>`, a cast that can express anything.
   */
  with<U = T>(overrides: Partial<FieldData>): Field<U> {
    return new Field<U>({ ...this, ...overrides });
  }
}

/** A record of fields — the input to `entity()` and every derivation. */
export type Fields = Record<string, Field>;

/**
 * A field's DATA — the class with its behaviour removed.
 *
 * Derived, not restated: the five slots are declared once, on `Field`, so a 6th axis lands
 * here for free — and so would a second method, which `Omit<Field, 'with'>` would have
 * missed, naming what to drop instead of saying what to keep.
 *
 * One name and not two. Building states all of it (`constructor`), modifying states the
 * difference (`Partial`, in `with`) — that is a `Partial` at one call site, not a second
 * concept. And that this type has to exist at all is what `with` costs: an object literal
 * cannot satisfy `Field` itself, having no method, so the data half needs its own name.
 */
export type FieldData = {
  [K in keyof Field as Field[K] extends (...args: never[]) => unknown ? never : K]: Field[K];
};

/** Duck type for anything with fields — Entity, SchemaConstructor. */
export interface SchemaLike {
  getFields(): Fields;
  /** The view's validation mode (patch…) — carried by SchemaConstructor, optional on bare wrappers. */
  getOpts?(): { patch?: boolean };
  /** Field groups unique together — carried by SchemaConstructor, absent on bare wrappers. */
  getUnique?(): ReadonlyArray<ReadonlyArray<string>> | undefined;
}

/**
 * Is this a field? Asked of its FORM, not of its origin.
 *
 * It used to read a `__brand` stamped by `createField` — a nominal test, which answers
 * "did this come through us". Two things made that the wrong question. A field crosses
 * processes and languages as plain JSON, where a private stamp means nothing and has to
 * be re-applied on arrival to keep the lie coherent; and the stamp let a hand-written
 * object claim to be a field on the strength of one string — three fixtures in
 * `@fougere/core` carried a vocabulary three refactors old, passed this test for months,
 * and only fell over once `shape` became required.
 *
 * `shape` answers both: every field states one, no non-field does, and it survives
 * `JSON.stringify` — the only place the question is ever really asked.
 *
 * And it is asked of the shape's FORM, via {@link isShape}, not of its presence. Asking
 * only whether the key was there admitted `{ shape: 42 }` and `{ shape: {} }` — the first
 * crashed inside the validator, the second judged nothing — which is the same presence-
 * versus-form mistake `__brand` made, one level down.
 */
export function isField(value: unknown): value is Field {
  return typeof value === 'object' && value !== null && isShape((value as Field).shape);
}

