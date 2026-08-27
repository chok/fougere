import { type Fields } from '../fields/Field.js';
import { type PreviousNames } from '../EntityDeclarations.js';
import { EntityAdapterSet, type EntityAdapters } from '../EntityAdapters.js';
import { SchemaDerivation } from './SchemaDerivation.js';
import { type ValidateOptions } from '../judge/options.js';
import type { SchemaView } from './SchemaView.js';

/**
 * Everything a schema IS, apart from being a class whose instances are rows.
 *
 * The five members used to be five statics assigned side by side, and every derivation
 * re-threaded them by hand — which is how one of them came to be dropped from a list
 * without anyone noticing. A transformation here returns a COMPLETE definition or it does
 * not compile, so no gesture can mix the fields of one with the options of another.
 *
 * Internal: it is not exported from the package and never appears on `SchemaConstructor`.
 * A user derives with `Order.pick(…)`, never `Order.definition.pick(…)`.
 */
export class SchemaDefinition {
  private constructor(
    readonly fields: Fields,
    readonly adapters: EntityAdapters<Fields> | undefined,
    readonly opts: ValidateOptions,
    readonly previous: PreviousNames<Fields> | undefined,
    readonly derivation: SchemaDerivation | undefined,
  ) {}

  static stated(said: {
    fields: Fields;
    adapters?: EntityAdapters<Fields>;
    opts?: ValidateOptions;
    previous?: PreviousNames<Fields>;
    derivation?: SchemaDerivation;
  }): SchemaDefinition {
    return new SchemaDefinition(
      said.fields, EntityAdapterSet.of(said.adapters)?.stated, said.opts ?? {}, said.previous, said.derivation,
    );
  }

  /**
   * `pick`, `omit` and `rename` are one gesture: the fields that remain, and what became
   * of each name. What each adapter was handed follows the same correspondence, and so does the origin.
   */
  cut(fields: Fields, survives: (key: string) => string | undefined, root: SchemaView): SchemaDefinition {
    const renamed: Fields = {};
    for (const [key, field] of Object.entries(fields)) renamed[key] = field.rename(survives);
    return new SchemaDefinition(
      renamed,
      EntityAdapterSet.of(this.adapters)?.cut(survives)?.stated,
      this.opts,
      undefined,
      this.origin(root).compose(survives),
    );
  }

  /** The same fields, judged as an update. */
  patched(root: SchemaView): SchemaDefinition {
    return new SchemaDefinition(
      { ...this.fields }, this.adapters, { ...this.opts, patch: true }, undefined, this.origin(root),
    );
  }

  /** The added fields have no origin, so the derivation is unchanged: it speaks of the root. */
  extended(extra: Fields, root: SchemaView): SchemaDefinition {
    return new SchemaDefinition(
      { ...this.fields, ...extra }, this.adapters, this.opts, undefined, this.origin(root),
    );
  }

  /** Several views folded into one definition, which therefore has no single origin. */
  static merged(views: readonly SchemaView[]): SchemaDefinition {
    const fields: Fields = {};
    let opts: ValidateOptions = {};
    for (const view of views) {
      Object.assign(fields, view.getFields());
      opts = { ...opts, ...view.getOpts() };
    }
    const adapters = EntityAdapterSet.merged(views.map((view) => view.getAdapters()))?.stated;

    return new SchemaDefinition(fields, adapters, opts, undefined, undefined);
  }

  /** The origin this definition already carries, or the one `root` becomes. */
  private origin(root: SchemaView): SchemaDerivation {
    return this.derivation ?? SchemaDerivation.first(root, this.fields);
  }
}
