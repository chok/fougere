import { type Fields } from './field/Field.js';
import { FieldSet, deduplicated } from './field/FieldSet.js';
import {
  type CompositeUnique,
  type EntityDeclarations,
  type PreviousNames,
} from './entity/EntityDeclarations.js';
import { type EntityAdapters } from './entity/EntityAdapters.js';
import { EntityAdapterSet } from './entity/EntityAdapterSet.js';
import { SchemaDerivation } from './SchemaDerivation.js';
import { type ValidateOptions } from './judge/options.js';
import type { SchemaView } from './SchemaView.js';

/**
 * What a schema constrains beyond any single field.
 *
 * `unique` is the one member today. It sits under an owner rather than beside `fields`
 * and `opts` because the next rule spanning two fields — a check, an exclusion — is a
 * member here, not an eighth positional argument in a list that has already lost one.
 */
export interface SchemaConstraints<TFields extends Fields = Fields> {
  readonly unique?: CompositeUnique<TFields>;
}

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
    readonly constraints: SchemaConstraints = {},
  ) {}

  /** Built complete or not at all — no static assigned on the side. */
  static of(declaration: {
    fields: Fields;
    adapters?: EntityAdapters<Fields>;
    opts?: ValidateOptions;
    previous?: PreviousNames<Fields>;
    derivation?: SchemaDerivation;
    anchored?: boolean;
    constraints?: SchemaConstraints;
  }): SchemaDefinition {
    return new SchemaDefinition(
      declaration.fields,
      EntityAdapterSet.of(declaration.adapters),
      declaration.opts ?? {},
      declaration.previous,
      declaration.derivation,
      declaration.anchored ?? false,
      declaration.constraints,
    );
  }

  declaring(declarations: EntityDeclarations<Fields>): SchemaDefinition {
    const declared = FieldSet.declaring(this.fields, declarations.unique);

    return new SchemaDefinition(
      declared.fields,
      EntityAdapterSet.merged([this.adapterSet, EntityAdapterSet.of(declarations.adapters)]),
      this.opts,
      declarations.previous ?? this.previous,
      this.derivation,
      this.anchored,
      { unique: declared.unique },
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
      this.constraints,
    );
  }

  derived(
    fields: Fields,
    transform: (key: string) => string | undefined,
    root: SchemaView,
  ): SchemaDefinition {
    return new SchemaDefinition(
      fields,
      this.adapterSet.rename(transform),
      this.opts,
      undefined,
      this.origin(root).rename(transform),
      false,
      this.constraintsRenamed(transform),
    );
  }

  /** One member gone and the group is gone: it constrained a pair that no longer exists. */
  private constraintsRenamed(
    transform: (key: string) => string | undefined,
  ): SchemaConstraints {
    if (!this.constraints.unique) return this.constraints;
    const kept: string[][] = [];
    for (const group of this.constraints.unique) {
      const renamed = group.map(transform);
      if (renamed.every((key): key is string => key !== undefined)) kept.push(renamed);
    }

    return { unique: deduplicated(kept) as CompositeUnique<Fields> | undefined };
  }

  patched(root: SchemaView): SchemaDefinition {
    return new SchemaDefinition(
      { ...this.fields },
      this.adapterSet,
      { ...this.opts, patch: true },
      undefined,
      this.origin(root),
      false,
      this.constraints,
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
      this.constraints,
    );
  }

  /** Several schemas fold into one, which has no single origin to point at. */
  static merged(views: readonly SchemaView[]): SchemaDefinition {
    const fields: Fields = {};
    let opts: ValidateOptions = {};
    const groups: (readonly string[])[] = [];
    for (const view of views) {
      Object.assign(fields, view.getFields());
      opts = { ...opts, ...view.getOpts() };
      groups.push(...(view.getUnique() ?? []));
    }
    const adapterSet = EntityAdapterSet.merged(
      views.map((view) => EntityAdapterSet.of(view.getAdapters())),
    );

    return new SchemaDefinition(
      fields,
      adapterSet,
      opts,
      undefined,
      undefined,
      false,
      { unique: deduplicated(groups) as CompositeUnique<Fields> | undefined },
    );
  }

  private origin(root: SchemaView): SchemaDerivation {
    if (!this.anchored && this.derivation) return this.derivation;

    return SchemaDerivation.first(root, this.fields);
  }
}
