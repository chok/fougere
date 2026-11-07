import type { Shape } from '../axis/shape/Shape.js';
import { Axes } from '../axis/Axes.js';
import type { FougereFieldAxes } from '../FougereFieldAxes.js';
import { FieldDeclarationValidator } from '../validator/FieldDeclarationValidator.js';
import { FieldValueValidator } from '../validator/FieldValueValidator.js';
import { isObject } from '../lib/utils.js';
import { dotted } from '../lib/ValidationResult.js';
import { SchemaError } from '../SchemaError.js';

/** The sentence any word admits, whatever it shapes — a relation and a date carry one too. */
export interface Described {
  description?: string;
}

/** And a value it is born with, for the words that shape one. `many()` has none to hold. */
export interface Shared<T> extends Described {
  default?: T;
}

export interface FieldDeclaration extends FougereFieldAxes {
  shape: Shape;
}

const refuseLooseOptions = (opts: unknown): void => {
  if (!isObject(opts))
    throw new SchemaError('Options must go in an object, like { max: 200 }', { received: opts });
};

const registered = (): (keyof FieldDeclaration)[] => Axes.names as (keyof FieldDeclaration)[];

/** A field: its shape, and one member per registered axis. */
export interface Field<T = unknown> extends FougereFieldAxes {
  readonly _type?: T;
}

export class Field<T = unknown> {
  readonly shape: Shape;

  constructor(init: FieldDeclaration, key?: string) {
    const verdict = FieldDeclarationValidator.of(init).verdict;

    if (!verdict.success) {
      throw new SchemaError(
        `${key ? `Field '${key}': ` : ''}` +
          verdict.errors.map((e) => `${dotted(e.path)}: ${e.message}`).join('; '),
      );
    }

    this.shape = init.shape;

    for (const name of registered()) {
      Object.defineProperty(this, name, {
        value: init[name], writable: true, enumerable: true, configurable: true,
      });
    }

    const create = this.lifecycle?.create;
    if (typeof create === 'object' && create !== null && 'value' in create) {
      const checked = FieldValueValidator.of(this).validate(create.value);
      if ('message' in checked)
        throw new SchemaError(
          `${key ? `Field '${key}': ` : ''}the default ${JSON.stringify(create.value)} is not valid: ${checked.message}.`,
        );
    }
  }

  static is(value: unknown): value is Field {
    return FieldDeclarationValidator.of(value).verdict.success;
  }

  /** What the field declares on one axis, read by name. */
  axis(name: keyof FieldDeclaration): unknown {
    return (this satisfies FieldDeclaration)[name];
  }

  /** Every axis it declares, and nothing for the ones it says nothing on. */
  get axes(): Record<string, unknown> {
    return Object.fromEntries(
      registered()
        .map((name) => [name, this.axis(name)])
        .filter(([, declared]) => declared !== undefined),
    );
  }

  /** Whether it states anything at all beside its shape. */
  hasAxes(): boolean {
    return registered().some((name) => this.axis(name) !== undefined);
  }

  with<U = T>(overrides: Partial<FieldDeclaration>): Field<U> {
    return new Field<U>({ ...this, ...overrides });
  }

  /** Applies the options every word admits: `description` and `default`. */
  setShared(opts?: Shared<T>): Field<T> {
    if (opts === undefined) return this;

    refuseLooseOptions(opts);

    const overrides: Partial<FieldDeclaration> = {
      ...(opts.description !== undefined
        ? { shape: { ...this.shape, description: opts.description } }
        : {}),
      ...(opts.default !== undefined
        ? { lifecycle: { ...this.lifecycle, create: { value: opts.default } } }
        : {}),
    };

    return Object.keys(overrides).length ? this.with<T>(overrides) : this;
  }
}
