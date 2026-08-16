import type { Shape } from './axis/shape/Shape.js';
import { Judge } from './judge/Judge.js';
import type { RoleRules } from './axis/role/Role.js';
import { FieldGroup } from './axis/role/FieldGroup.js';
import { Unique } from './axis/role/Unique.js';
import type { LifecycleRules } from './axis/lifecycle/Lifecycle.js';
import type { BoundaryRef } from './axis/boundary/Boundary.js';
import type { Meta } from './axis/Meta.js';

/**
 * One field — a `shape`, plus the three optional axes (`role`, `lifecycle`, `boundary`) and
 * `meta`. The constructor judges `init`, so an illegal field cannot exist; `key` only names
 * it in the message.
 *
 * ```ts
 * new Field({ shape: { type: 'string', minLength: 1 } })
 *
 * new Field({ lifecycle: { update: 'now' } }, 'title')
 * // → throws: Field 'title': shape: Every field states a shape — got undefined
 * new Field({ shape: { type: 'string' }, role: { primary: 'yes' } }, 'title')
 * // → throws: Field 'title': role.primary: Expected a boolean — got "yes"
 * text({ min: 1, default: '' })
 * // → throws: the declared default "" is not a legal value for it — String is too short (0 < 1).
 * ```
 */
export class Field<T = unknown> {
  readonly shape: Shape;
  readonly role?: RoleRules;
  readonly lifecycle?: LifecycleRules;
  readonly boundary?: BoundaryRef;
  readonly meta?: Meta;
  declare readonly _type?: T;

  constructor(init: FieldData, key?: string) {
    const verdict = Judge.field(init);

    if (!verdict.success) {
      throw new Error(
        `${key ? `Field '${key}': ` : ""}` +
          verdict.errors.map((e) => `${e.path}: ${e.message}`).join("; "),
      );
    }

    this.shape = init.shape;
    this.role = normalizeRole(init.role);
    this.lifecycle = init.lifecycle;
    this.boundary = init.boundary;
    this.meta = init.meta;

    // A declared default is written into every row without ever passing `Judge.row`, so the
    // only place it can meet its own shape is here. The field is illegal on its own: no
    // entity is needed to know that `''` is not a string of at least one character.
    const create = this.lifecycle?.create;
    if (typeof create === "object" && create !== null && "value" in create) {
      const checked = Judge.value(this, create.value);
      if ("error" in checked)
        throw new Error(
          `${key ? `Field '${key}': ` : ""}the declared default ${JSON.stringify(create.value)} ` +
            `is not a legal value for it — ${checked.error}.`,
        );
    }
  }

  /**
   * A copy with some axes replaced. The original is untouched, and the result is judged
   * again — an illegal override throws here too.
   *
   * ```ts
   * const t = text({ min: 1 })
   * t.with({ role: { primary: true } })
   * //   → { shape: { type: 'string', minLength: 1 }, role: { primary: true } }
   * t   // → { shape: { type: 'string', minLength: 1 } }   unchanged
   * ```
   */
  with<U = T>(overrides: Partial<FieldData>): Field<U> {
    return new Field<U>({ ...this, ...overrides });
  }

  /**
   * The same field under new key names — the ONE place a derivation carries what a field
   * says about other fields. A uniqueness group that lost a member is dropped, never
   * narrowed.
   *
   * ```ts
   * const listId = fields.listId   // role.rules = [Unique('listId','docId')]
   * listId.rename(k => k === 'docId' ? 'bookId' : k)  // → role.rules = [Unique('listId','bookId')]
   * listId.rename(k => k === 'docId' ? undefined : k) // → role.rules gone
   * ```
   */
  rename(map: (key: string) => string | undefined): Field<T> {
    const rules = this.role?.rules;
    if (!rules?.length) return this;

    const carried = rules.map((group) => group.rename(map)).filter((group) => group !== null);
    // By VALUE, not by count: a pure rename loses nothing, and comparing lengths kept the
    // field with its old member names. It went unseen while `getUnique()` answered from a
    // second copy that WAS renamed — the two disagreed, and only the copy was read.
    const unchanged =
      carried.length === rules.length && carried.every((group, i) => group.equals(rules[i]!));
    if (unchanged) return this;

    const { rules: _dropped, ...rest } = this.role!;
    return this.with({ role: carried.length ? { ...rest, rules: carried } : rest });
  }
}

/**
 * The door's normalization: a role may be handed in with plain member lists and comes out
 * canonical. `Unique` is the only kind a bare list can denote today — a second kind would
 * need the list to say which, and that is the day this stops being derivable.
 */
function normalizeRole(role: RoleRules | undefined): RoleRules | undefined {
  const rules = FieldGroup.normalize(role?.rules, (members) => Unique.of(...members));
  return rules === role?.rules ? role : { ...role, rules };
}

/** A record of fields — the input to `entity()` and every derivation. */
export type Fields = Record<string, Field>;

export type FieldData = {
  [K in keyof Field as Field[K] extends (...args: never[]) => unknown
    ? never
    : K]: Field[K];
};
