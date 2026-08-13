import type { Shape } from "./shape.js";
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
   * The five slots, always the same five, whatever the caller passed — so the
   * constructor IS the normaliser. `new Field(x)` on anything field-shaped answers a
   * canonical field, which is why {@link normalizeFields} is a loop around this line
   * and why nothing downstream has to ask where a field came from.
   *
   * Where a plain object stands, exactly: the RUNTIME takes one — {@link normalizeFields}
   * asks {@link isField}, which reads the shape and never the constructor, so a config, a
   * plain-JS caller and a card another language wrote all get in and come out canonical.
   * TypeScript does NOT: `with` is a member, and an object literal has no `with`, so
   * `entity({ t: { shape } })` is a type error where the same call succeeds from JS.
   *
   * That asymmetry is the method's real price, and it is the affordable half — the untyped
   * callers are precisely the ones no compiler was ever going to serve, and a TS caller has
   * the vocabulary. What was NOT affordable is the runtime door, which is why it stays open.
   * (No `private` member either, so nothing about the class is nominal: `instanceof` is
   * never the question asked of a field, here or anywhere downstream.)
   */
  constructor(init: FieldData) {
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

/**
 * Any field, regardless of its `T` — the correct generic bound.
 *
 * `unknown` and not `any`: the bound accepts every concrete field either way, and
 * the whole workspace typechecks either way. The difference shows where the field
 * map is no longer captured by a generic — `SchemaViewInfer<Fields>` reads this `T`,
 * so `any` handed a silent value to every consumer that lost the precise map.
 *
 * One parameter and not two: a second one carried "auto-supplied at creation", a
 * type-level copy of `lifecycle.create` that had to be restated by hand in every word
 * that could set the rule — and had drifted, on `default`. See {@link Fields}.
 */
export type AnyField = Field<unknown>;

/** A record of fields — the input to `entity()` and every derivation. */
export type Fields = Record<string, AnyField>;

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
 */
export function isField(value: unknown): value is AnyField {
  return (
    typeof value === "object" &&
    value !== null &&
    Boolean((value as AnyField).shape)
  );
}

/**
 * Bring a field map into canonical form, refusing what is not a field — THE door.
 *
 * The dual of checking: rather than ask every reader downstream to trust a stamp, the
 * entry point REBUILDS what it was handed. So a map may legitimately arrive as plain
 * data — from a `fougere.config.ts`, from JS with no compiler in front of it, from a
 * card another language wrote — and what comes out is a field like any other, with the
 * same five slots and nothing extra riding along.
 *
 * A shapeless entry is named and refused here rather than three layers down: it used to
 * be legal, judged NOTHING (every value accepted), and reached `adapter/sql` as an
 * invented `text not null` column, so the failure surfaced at the driver on an insert.
 */
export function normalizeFields(fields: Fields): Fields {
  const out: Fields = {};
  for (const [name, field] of Object.entries(fields)) {
    if (!isField(field)) {
      throw new Error(
        `Field '${name}': not a field — got ${JSON.stringify(field)}. ` +
          `Use the vocabulary (text(), number(), primary(), many()…); every field states a shape.`,
      );
    }
    out[name] = new Field(field);
  }
  return out;
}
