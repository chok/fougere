import type { Shape } from '../axis/shape/Shape.js';
import type { RoleRules } from '../axis/role/RoleRules.js';
import type { LifecycleRules } from '../axis/lifecycle/LifecycleRules.js';
import type { BoundaryRef } from '../axis/boundary/BoundaryRef.js';
import type { Meta } from './Meta.js';
import { Axes } from '../axis/Axes.js';
import type { FougereFieldAxes } from './FougereFieldAxes.js';
import { FieldDeclarationValidator } from '../validator/FieldDeclarationValidator.js';
import { FieldValueValidator } from '../validator/FieldValueValidator.js';
import { dotted } from '../lib/ValidationResult.js';
import { SchemaError } from '../SchemaError.js';

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

    for (const axis of Axes.all) {
      (this as unknown as Record<string, unknown>)[axis.slot] = stated[axis.slot];
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
}
