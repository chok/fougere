import type { Shape } from '../axis/shape/Shape.js';
import type { RoleRules } from '../axis/role/Role.js';
import type { LifecycleRules } from '../axis/lifecycle/Lifecycle.js';
import type { BoundaryRef } from '../axis/boundary/Boundary.js';
import { Axes } from '../axis/Axes.js';
import type { FougereFieldAxes } from './FougereFieldAxes.js';
import { FieldDeclarationValidator } from '../validator/FieldDeclarationValidator.js';
import { FieldValueValidator } from '../validator/FieldValueValidator.js';
import { dotted } from '../lib/ValidationResult.js';
import { SchemaError } from '../SchemaError.js';

/**
 * Where a shared option lands: `default` IS a lifecycle rule and `description` IS a JSON Schema
 * keyword, so it belongs to the shape rather than beside it.
 * The fact is stated here alone, so neither a word nor this class writes the conversion.
 */
const SHARED: Readonly<Record<string, readonly [string, ...string[]]>> = {
  default: ['lifecycle', 'create', 'value'],
  description: ['shape', 'description'],
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
}

export class Field<T = unknown> {
  readonly shape: Shape;
  readonly role?: RoleRules;
  readonly lifecycle?: LifecycleRules;
  readonly boundary?: BoundaryRef;

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

    const stated = init as unknown as Record<string, unknown>;

    for (const name of Axes.names) {
      (this as unknown as Record<string, unknown>)[name] = stated[name];
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

  /**
   * What this field states under one axis, a fourth one declared outside included. The axes
   * are members, so reading one by NAME is the one cast a field owns; three callers wrote it
   * themselves.
   */
  stated(name: string): unknown {
    return (this as unknown as Record<string, unknown>)[name];
  }

  with<U = T>(overrides: Partial<FieldDeclaration>): Field<U> {
    return new Field<U>({ ...this, ...overrides });
  }

  /**
   * What a word admits whatever its shape, written where `SHARED` says it lands.
   * FR : ce que tout mot admet quelle que soit sa forme, écrit là où `SHARED` dit.
   * `text({ max: 200 }).setShared({ description: 'The title' })` → `shape.description`
   */
  setShared(opts?: Shared<T>): Field<T> {
    const given = opts as Record<string, unknown> | undefined;
    const stated = this as unknown as Record<string, object | undefined>;
    const overrides: Record<string, unknown> = {};

    for (const [option, [name, ...under]] of Object.entries(SHARED)) {
      const value = given?.[option];

      if (value === undefined) continue;

      const member = under.reduceRight<unknown>((held, key) => ({ [key]: held }), value);
      overrides[name] = { ...(overrides[name] ?? stated[name]), ...(member as object) };
    }

    return Object.keys(overrides).length ? this.with<T>(overrides) : this;
  }
}
