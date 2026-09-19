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

/** What every word admits, whatever it shapes — stated once, extended by each one's options. */
export interface Shared<T> {
  default?: T;
  description?: string;
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
   * What a word admits whatever its shape, put where each one lands — `default` is a
   * lifecycle rule, `description` is meta, and no word writes either conversion itself.
   * FR : ce que tout mot admet quelle que soit sa forme, posé là où chacun atterrit.
   * `text({ max: 200 }).setShared({ description: 'The title' })` → `meta.description`
   */
  setShared(opts?: Shared<T>): Field<T> {
    const overrides: Partial<FieldDeclaration> = {};

    if (opts?.default !== undefined)
      overrides.lifecycle = { ...this.lifecycle, create: { value: opts.default } };

    if (opts?.description !== undefined)
      overrides.meta = { ...this.meta, description: opts.description };

    return Object.keys(overrides).length ? this.with<T>(overrides) : this;
  }
}
