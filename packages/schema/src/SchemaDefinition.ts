import { type Fields } from './field/Fields.js';
import { FieldSet } from './field/FieldSet.js';

import { type EntityDeclarations } from './entity/EntityDeclarations.js';
import { type PreviousNames } from './entity/PreviousNames.js';
import { EntityAdapterSet } from './entity/EntityAdapterSet.js';
import { SchemaDerivation } from './SchemaDerivation.js';
import { type ValidateOptions } from './validator/ValidateOptions.js';
import type { SchemaView } from './SchemaView.js';
import { SchemaConstraints } from './SchemaConstraints.js';
import { SchemaError } from './SchemaError.js';
import type { ConstraintKind } from './SchemaConstraints.js';

type SchemaState = Pick<
  SchemaDefinition,
  'fields' | 'adapterSet' | 'opts' | 'previous' | 'derivation' | 'anchored' | 'constraints'
>;

/** What a schema is built from; the rest is stated by `declares` or inherited by a derivation. */
export interface SchemaDeclaration<TFields extends Fields> {
  fields: TFields;
  opts?: ValidateOptions;
  constraints?: SchemaConstraints;
}

type Renaming = ReadonlyMap<string, string>;

/** Everything a schema is, apart from being a class. */
export class SchemaDefinition {
  readonly fields: Fields;
  readonly adapterSet: EntityAdapterSet;
  readonly opts: ValidateOptions;
  readonly previous: PreviousNames<Fields> | undefined;
  readonly derivation: SchemaDerivation | undefined;
  readonly anchored: boolean;
  readonly constraints: SchemaConstraints;

  private constructor(state: SchemaState) {
    this.fields = state.fields;
    this.adapterSet = state.adapterSet;
    this.opts = state.opts;
    this.previous = state.previous;
    this.derivation = state.derivation;
    this.anchored = state.anchored;
    this.constraints = state.constraints;
  }

  private static derived(state: Omit<SchemaState, 'previous' | 'anchored'>): SchemaDefinition {
    return new SchemaDefinition({ ...state, previous: undefined, anchored: false });
  }

  private restated(state: Partial<SchemaState>): SchemaDefinition {
    return new SchemaDefinition({ ...this, ...state });
  }

  /** Built complete or not at all — no static assigned on the side. */
  static of(declaration: SchemaDeclaration<Fields>): SchemaDefinition {
    return SchemaDefinition.derived({
      fields: declaration.fields,
      adapterSet: EntityAdapterSet.none,
      opts: declaration.opts ?? {},
      derivation: undefined,
      constraints: declaration.constraints ?? SchemaConstraints.none,
    });
  }

  declaring(declarations: EntityDeclarations<Fields>): SchemaDefinition {
    const adapterSet = EntityAdapterSet.of(declarations.adapters);
    this.assertKnown('declares', [
      ...adapterSet.fieldNames,
      ...Object.keys(declarations.previous ?? {}),
    ]);
    const declared = FieldSet.declaring(this.fields, declarations);

    return this.restated({
      fields: declared.fields,
      adapterSet: EntityAdapterSet.merged([this.adapterSet, adapterSet]),
      previous: declarations.previous ?? this.previous,
      constraints:
        declarations.unique === undefined && declarations.index === undefined
          ? this.constraints
          : SchemaConstraints.of(declared),
    });
  }

  anchoring(): SchemaDefinition {
    return this.restated({ anchored: true });
  }

  pick(keys: readonly string[], root: SchemaView): SchemaDefinition {
    this.assertKnown('pick', keys);

    return this.renaming(new Map(keys.map((key) => [key, key])), root);
  }

  omit(keys: readonly string[], root: SchemaView): SchemaDefinition {
    this.assertKnown('omit', keys);
    const kept = Object.keys(this.fields).filter((key) => !keys.includes(key));

    return this.renaming(new Map(kept.map((key) => [key, key])), root);
  }

  rename(mapping: Record<string, string>, root: SchemaView): SchemaDefinition {
    this.assertKnown('rename', Object.keys(mapping));
    const here = Object.keys(this.fields).map((key) => [key, mapping[key] ?? key] as const);

    return this.renaming(new Map(here), root);
  }

  private renaming(kept: Renaming, root: SchemaView): SchemaDefinition {
    const fields: Fields = {};
    for (const [from, to] of kept) {
      const field = this.fields[from];
      if (field) fields[to] = field;
    }
    const nameOf = (key: string) => kept.get(key);

    return SchemaDefinition.derived({
      fields,
      adapterSet: this.adapterSet.rename(nameOf),
      opts: this.opts,
      derivation: this.origin(root).rename(nameOf),
      constraints: this.constraints.renamed(nameOf),
    });
  }

  patched(root: SchemaView): SchemaDefinition {
    return SchemaDefinition.derived({
      fields: { ...this.fields },
      adapterSet: this.adapterSet,
      opts: { ...this.opts, patch: true },
      derivation: this.origin(root),
      constraints: this.constraints,
    });
  }

  /** An added field does not pretend to come from the root, which never declared it. */
  extended(extra: Fields, root: SchemaView): SchemaDefinition {
    return SchemaDefinition.derived({
      fields: { ...this.fields, ...extra },
      adapterSet: this.adapterSet,
      opts: this.opts,
      derivation: this.origin(root),
      constraints: this.constraints,
    });
  }

  /** Several schemas fold into one, which has no single origin to point at. */
  static merged(views: readonly SchemaView[]): SchemaDefinition {
    const fields: Fields = {};
    let opts: ValidateOptions = {};
    const groups: Record<ConstraintKind, (readonly string[])[]> = { unique: [], index: [] };
    for (const view of views) {
      Object.assign(fields, view.getFields());
      opts = { ...opts, ...view.getOpts() };
      groups.unique.push(...view.getUnique());
      groups.index.push(...view.getIndex());
    }

    return SchemaDefinition.derived({
      fields,
      adapterSet: EntityAdapterSet.merged(
        views.map((view) => EntityAdapterSet.of(view.getAdapters())),
      ),
      opts,
      derivation: undefined,
      constraints: SchemaConstraints.of(groups),
    });
  }

  private assertKnown(operation: string, keys: readonly string[]): void {
    const strangers = keys.filter((key) => !Object.hasOwn(this.fields, key));
    if (strangers.length === 0) return;

    throw new SchemaError(
      `${operation}(): unknown field ${strangers.map((s) => `\`${s}\``).join(', ')}. ` +
        `This schema carries ${Object.keys(this.fields).join(', ')}.`,
    );
  }

  private origin(root: SchemaView): SchemaDerivation {
    if (!this.anchored && this.derivation) return this.derivation;

    return SchemaDerivation.first(root, this.fields);
  }
}
