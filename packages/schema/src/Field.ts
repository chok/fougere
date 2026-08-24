import type { Shape } from './axis/shape/Shape.js';
import type { RoleRules } from './axis/role/Role.js';
import { FieldGroup } from './constraint/FieldGroup.js';
import { Unique } from './constraint/Unique.js';
import type { LifecycleRules } from './axis/lifecycle/Lifecycle.js';
import type { BoundaryRef } from './axis/boundary/Boundary.js';
import type { Meta } from './axis/Meta.js';
import { FieldJudge } from './judge/FieldJudge.js';
import { ValueJudge } from './judge/ValueJudge.js';

export class Field<T = unknown> {
  readonly shape: Shape;
  readonly role?: RoleRules;
  readonly lifecycle?: LifecycleRules;
  readonly boundary?: BoundaryRef;
  readonly meta?: Meta;
  declare readonly _type?: T;

  constructor(init: FieldData, key?: string) {
    const verdict = FieldJudge.of(init).verdict;

    if (!verdict.success) {
      throw new Error(
        `${key ? `Field '${key}': ` : ""}` +
          verdict.errors.map((e) => `${e.path}: ${e.message}`).join("; "),
      );
    }

    this.shape = init.shape;
    this.role = normalizeRole(init.role, key);
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

  with<U = T>(overrides: Partial<FieldData>): Field<U> {
    return new Field<U>({ ...this, ...overrides });
  }

  rename(map: (key: string) => string | undefined): Field<T> {
    const rules = this.role?.rules;
    if (!rules?.length) return this;

    const carried = rules.map((group) => group.rename(map)).filter((group) => group !== null);
    const unchanged =
      carried.length === rules.length && carried.every((group, i) => group.equals(rules[i]!));
    if (unchanged) return this;

    const { rules: _dropped, ...rest } = this.role!;
    return this.with({ role: carried.length ? { ...rest, rules: carried } : rest });
  }
}

function normalizeRole(role: RoleRules | undefined, key?: string): RoleRules | undefined {
  let rules = FieldGroup.normalize(role?.rules, (members) => new Unique(members));
  if (rules && key !== undefined && rules.some((group) => group.isSelf))
    rules = rules.map((group) => group.resolvedOn(key));
  return rules === role?.rules ? role : { ...role, rules };
}

export type Fields = Record<string, Field>;

export type FieldData = {
  [K in keyof Field as Field[K] extends (...args: never[]) => unknown
    ? never
    : K]: Field[K];
};
