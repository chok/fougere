import { type Fields } from './field/Field.js';
import { FieldSet } from './field/FieldSet.js';
import {
  type EntityDeclarations,
  type PreviousNames,
} from './entity/EntityDeclarations.js';
import { type EntityAdapters } from './entity/EntityAdapters.js';
import { EntityAdapterSet } from './entity/EntityAdapterSet.js';
import { SchemaDerivation } from './SchemaDerivation.js';
import { type ValidateOptions } from './judge/options.js';
import type { SchemaView } from './SchemaView.js';

/**
 * Everything a schema IS, apart from being a class whose instances are rows.
 *
 * The members used to be that many statics assigned side by side, and every derivation
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
    readonly adapterSet: EntityAdapterSet,
    readonly opts: ValidateOptions,
    readonly previous: PreviousNames<Fields> | undefined,
    readonly derivation: SchemaDerivation | undefined,
    readonly anchored: boolean,
  ) {}

  /** Built complete or not at all — no static assigned on the side. */
  static of(declaration: {
    fields: Fields;
    adapters?: EntityAdapters<Fields>;
    opts?: ValidateOptions;
    previous?: PreviousNames<Fields>;
    derivation?: SchemaDerivation;
    anchored?: boolean;
  }): SchemaDefinition {
    return new SchemaDefinition(
      declaration.fields,
      EntityAdapterSet.of(declaration.adapters),
      declaration.opts ?? {},
      declaration.previous,
      declaration.derivation,
      declaration.anchored ?? false,
    );
  }

  declaring(declarations: EntityDeclarations<Fields>): SchemaDefinition {
    return new SchemaDefinition(
      FieldSet.withUnique(this.fields, declarations.unique),
      EntityAdapterSet.merged([this.adapterSet, EntityAdapterSet.of(declarations.adapters)]),
      this.opts,
      declarations.previous ?? this.previous,
      this.derivation,
      this.anchored,
    );
  }

  anchoring(): SchemaDefinition {
    return new SchemaDefinition(
      this.fields,
      this.adapterSet,
      this.opts,
      this.previous,
      this.derivation,
      true,
    );
  }

  derived(
    fields: Fields,
    transform: (key: string) => string | undefined,
    root: SchemaView,
  ): SchemaDefinition {
    const renamed: Fields = {};
    for (const [key, field] of Object.entries(fields))
      renamed[key] = field.rename(transform);
    return new SchemaDefinition(
      renamed,
      this.adapterSet.rename(transform),
      this.opts,
      undefined,
      this.origin(root).rename(transform),
      false,
    );
  }

  patched(root: SchemaView): SchemaDefinition {
    return new SchemaDefinition(
      { ...this.fields },
      this.adapterSet,
      { ...this.opts, patch: true },
      undefined,
      this.origin(root),
      false,
    );
  }

  /** An added field does not pretend to come from the root, which never declared it. */
  extended(extra: Fields, root: SchemaView): SchemaDefinition {
    return new SchemaDefinition(
      { ...this.fields, ...extra },
      this.adapterSet,
      this.opts,
      undefined,
      this.origin(root),
      false,
    );
  }

  /** Several schemas fold into one, which has no single origin to point at. */
  static merged(views: readonly SchemaView[]): SchemaDefinition {
    const fields: Fields = {};
    let opts: ValidateOptions = {};
    for (const view of views) {
      Object.assign(fields, view.getFields());
      opts = { ...opts, ...view.getOpts() };
    }
    const adapterSet = EntityAdapterSet.merged(
      views.map((view) => EntityAdapterSet.of(view.getAdapters())),
    );

    return new SchemaDefinition(fields, adapterSet, opts, undefined, undefined, false);
  }

  private origin(root: SchemaView): SchemaDerivation {
    if (!this.anchored && this.derivation) return this.derivation;

    return SchemaDerivation.first(root, this.fields);
  }
}
