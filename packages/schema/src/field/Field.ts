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

/**
 * Every word ends on `setShared`, so the options are read in ONE place and refused there.
 * `text(42)` used to pass for a bare `text()`, and nine of the twelve words took it.
 */
const refuseLooseOptions = (opts: unknown): void => {
  if (!isObject(opts))
    throw new SchemaError('Options must go in an object, like { max: 200 }', { received: opts });
};

/** The registry answers strings, and a member of a declaration is what they name. */
const registered = (): (keyof FieldDeclaration)[] => Axes.names as (keyof FieldDeclaration)[];

/**
 * The axes it carries are `FougereFieldAxes`, which each axis writes its own line in — so the
 * three of the core are typed the way a fourth declared outside is, and the class names what
 * the registry decides only once, in the constructor.
 */
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
          `${key ? `Field '${key}': ` : ''}the declared default ${JSON.stringify(create.value)} ` +
            `is not a legal value for it — ${checked.message}.`,
        );
    }
  }

  static is(value: unknown): value is Field {
    return FieldDeclarationValidator.of(value).verdict.success;
  }

  /**
   * What this field declares on ONE axis, a fourth one registered outside included. An axis is
   * a member, so it is read by NAME, and three callers reached for it through a cast of their
   * own before this existed.
   */
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

  /**
   * What a word admits whatever its shape, and where it lands: `description` IS a JSON Schema
   * keyword, `default` IS a lifecycle rule. Stated here alone, so no word writes the conversion.
   * FR : ce que tout mot admet quelle que soit sa forme, et où ça atterrit.
   * `text({ max: 200 }).setShared({ description: 'The title' })` → `shape.description`
   */
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
