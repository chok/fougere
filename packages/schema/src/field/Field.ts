import type { Shape } from '../axis/shape/Shape.js';
import type { RoleRules } from '../axis/role/Role.js';
import type { LifecycleRules } from '../axis/lifecycle/Lifecycle.js';
import type { BoundaryRef } from '../axis/boundary/Boundary.js';
import type { Meta } from './Meta.js';
import { Axes } from '../axis/Axes.js';
import type { FougereFieldAxes } from './FougereFieldAxes.js';
import { FieldDeclarationValidator } from '../validator/FieldDeclarationValidator.js';
import { FieldValueValidator } from '../validator/FieldValueValidator.js';
import { dotted } from '../lib/ValidationResult.js';
import { SchemaError } from '../SchemaError.js';

/**
 * Where a shared option lands: `default` IS a lifecycle rule and `description` IS meta.
 * The fact is stated here alone, so neither a word nor this class writes the conversion.
 */
const SHARED: Readonly<Record<string, readonly [string, ...string[]]>> = {
  default: ['lifecycle', 'create', 'value'],
  description: ['meta', 'description'],
};

/** The sentence any word admits, whatever it shapes — a relation and a date carry one too. */
export interface Described {
  description?: string;
}

/** And a value it is born with, for the words that shape one. `many()` has none to hold. */
export interface Shared<T> extends Described {
  default?: T;
}

interface FieldDeclaration extends FougereFieldAxes {
  shape: Shape;
  role?: RoleRules;
  lifecycle?: LifecycleRules;
  boundary?: BoundaryRef;
  meta?: Meta;
}

export class Field<T = unknown> {
  readonly shape: Shape;
  readonly role?: RoleRules;
  readonly lifecycle?: LifecycleRules;
  readonly boundary?: BoundaryRef;
  readonly meta?: Meta;

  declare readonly _type?: T;

  constructor(init: FieldDeclaration, key?: string) {
    const verdict = FieldDeclarationValidator.of(init).verdict;

    if (!verdict.success) {
      throw new SchemaError(
        `${key ? `Field '${key}': ` : ''}` +
          verdict.errors.map((e) => `${dotted(e.path)}: ${e.message}`).join('; '),
      );
    }

    this.shape = init.shape;
    this.meta = init.meta;

    const stated = init as unknown as Record<string, unknown>;

    for (const slot of Axes.names) {
      (this as unknown as Record<string, unknown>)[slot] = stated[slot];
    }

    const create = this.lifecycle?.create;
    if (typeof create === 'object' && create !== null && 'value' in create) {
      const checked = FieldValueValidator.of(this).validate(create.value);
      if ('message' in checked)
        throw new SchemaError(
          `${key ? `Field '${key}': ` : ''}the declared default ${JSON.stringify(create.value)} ` +
            `is not a legal value for it — ${checked.message}.`,
        );
    }
  }

  static is(value: unknown): value is Field {
    return FieldDeclarationValidator.of(value).verdict.success;
  }

  with<U = T>(overrides: Partial<FieldDeclaration>): Field<U> {
    return new Field<U>({ ...this, ...overrides });
  }

  /**
   * What a word admits whatever its shape, written where `SHARED` says it lands.
   * FR : ce que tout mot admet quelle que soit sa forme, écrit là où `SHARED` dit.
   * `text({ max: 200 }).setShared({ description: 'The title' })` → `meta.description`
   */
  setShared(opts?: Shared<T>): Field<T> {
    const stated = opts as Record<string, unknown> | undefined;
    const axes = this as unknown as Record<string, object | undefined>;
    const overrides: Record<string, unknown> = {};

    for (const [option, [axis, ...under]] of Object.entries(SHARED)) {
      const value = stated?.[option];

      if (value === undefined) continue;

      const member = under.reduceRight<unknown>((held, key) => ({ [key]: held }), value);
      overrides[axis] = { ...(overrides[axis] ?? axes[axis]), ...(member as object) };
    }

    return Object.keys(overrides).length ? this.with<T>(overrides) : this;
  }
}
