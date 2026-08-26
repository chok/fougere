import type { Shape } from "../axis/shape/Shape.js";
import { Role, type RoleRules } from "../axis/role/Role.js";
import type { LifecycleRules } from "../axis/lifecycle/Lifecycle.js";
import type { BoundaryRef } from "../axis/boundary/Boundary.js";
import type { Meta } from "../axis/Meta.js";
import type { Axis } from "../axis/Axis.js";
import { FieldJudge } from "../judge/FieldJudge.js";
import { ValueJudge } from "../judge/ValueJudge.js";

export type Fields = Record<string, Field>;

/** A key of a field set — the name a declaration addresses a field by. */
export type FieldName<TFields extends Fields> = Extract<keyof TFields, string>;

/** The carrier, the three extension axes, the annotation — the five the judge reads. */
export type FieldDeclaration = Pick<Field, "shape" | Axis["slot"] | "meta">;

export class Field<T = unknown> {
  readonly shape: Shape;
  readonly role?: RoleRules;
  readonly lifecycle?: LifecycleRules;
  readonly boundary?: BoundaryRef;
  readonly meta?: Meta;

  declare readonly _type?: T;

  constructor(init: FieldDeclaration, key?: string) {
    const verdict = FieldJudge.of(init).verdict;

    if (!verdict.success) {
      throw new Error(
        `${key ? `Field '${key}': ` : ""}` +
          verdict.errors.map((e) => `${e.path}: ${e.message}`).join("; "),
      );
    }

    this.shape = init.shape;
    this.role = Role.resolvedOn(init.role, key);
    this.lifecycle = init.lifecycle;
    this.boundary = init.boundary;
    this.meta = init.meta;

    const create = this.lifecycle?.create;
    if (typeof create === "object" && create !== null && "value" in create) {
      const checked = ValueJudge.of(this).check(create.value);
      if ("error" in checked)
        throw new Error(
          `${key ? `Field '${key}': ` : ""}the declared default ${JSON.stringify(create.value)} ` +
            `is not a legal value for it — ${checked.error}.`,
        );
    }
  }

  static is(value: unknown): value is Field {
    return FieldJudge.of(value).verdict.success;
  }

  with<U = T>(overrides: Partial<FieldDeclaration>): Field<U> {
    return new Field<U>({ ...this, ...overrides });
  }

  rename(map: (key: string) => string | undefined): Field<T> {
    const rules = this.role?.rules;
    if (!rules?.length) return this;

    const carried = rules
      .map((group) => group.rename(map))
      .filter((group) => group !== null);
    const unchanged =
      carried.length === rules.length &&
      carried.every((group, i) => group.equals(rules[i]!));
    if (unchanged) return this;

    const { rules: _dropped, ...rest } = this.role!;
    return this.with({
      role: carried.length ? { ...rest, rules: carried } : rest,
    });
  }
}

