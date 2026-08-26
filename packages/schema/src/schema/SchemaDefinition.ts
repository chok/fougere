import { type Fields } from '../Field.js';
import { type Previous } from '../EntityDeclarations.js';
import { deriveHints, type Hints } from '../Hints.js';
import { SchemaDerivation } from './SchemaDerivation.js';
import { type ValidateOptions } from '../judge/options.js';
import type { SchemaView } from '../SchemaView.js';

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
    readonly hints: Hints<Fields> | undefined,
    readonly opts: ValidateOptions,
    readonly previous: Previous<Fields> | undefined,
    readonly derivation: SchemaDerivation | undefined,
  ) {}

  static stated(said: {
    fields: Fields;
    hints?: Hints<Fields>;
    opts?: ValidateOptions;
    previous?: Previous<Fields>;
    derivation?: SchemaDerivation;
  }): SchemaDefinition {
    return new SchemaDefinition(said.fields, said.hints, said.opts ?? {}, said.previous, said.derivation);
  }

  /**
   * `pick`, `omit` and `rename` are one gesture: the fields that remain, and what became
   * of each name. The hints follow the same correspondence, and so does the origin.
   */
  cut(fields: Fields, survives: (key: string) => string | undefined, root: SchemaView): SchemaDefinition {
    const renamed: Fields = {};
    for (const [key, field] of Object.entries(fields)) renamed[key] = field.rename(survives);
    return new SchemaDefinition(
      renamed,
      deriveHints(this.hints, survives),
      this.opts,
      undefined,
      this.origin(root).compose(survives),
    );
  }

  /** The same fields, judged as an update. */
  patched(root: SchemaView): SchemaDefinition {
    return new SchemaDefinition(
      { ...this.fields }, this.hints, { ...this.opts, patch: true }, undefined, this.origin(root),
    );
  }

  /** The added fields have no origin, so the derivation is unchanged: it speaks of the root. */
  extended(extra: Fields, root: SchemaView): SchemaDefinition {
    return new SchemaDefinition(
      { ...this.fields, ...extra }, this.hints, this.opts, undefined, this.origin(root),
    );
  }

  /** Several views folded into one definition, which therefore has no single origin. */
  static merged(views: readonly SchemaView[]): SchemaDefinition {
    const fields: Fields = {};
    const hints: Record<string, Record<string, unknown>> = {};
    let opts: ValidateOptions = {};
    for (const view of views) {
      Object.assign(fields, view.getFields());
      const stated = view.getHints() as Record<string, Record<string, unknown> | undefined> | undefined;
      for (const [adapter, perField] of Object.entries(stated ?? {})) {
        if (!perField || typeof perField !== 'object') continue;
        hints[adapter] = { ...hints[adapter], ...perField };
      }
      opts = { ...opts, ...view.getOpts() };
    }
    const merged = Object.keys(hints).length ? (hints as Hints<Fields>) : undefined;
    return new SchemaDefinition(fields, merged, opts, undefined, undefined);
  }

  /** The origin this definition already carries, or the one `root` becomes. */
  private origin(root: SchemaView): SchemaDerivation {
    return this.derivation ?? SchemaDerivation.first(root, this.fields);
  }
}
