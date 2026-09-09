import { type FieldName, type Fields } from './field/Field.js';
import { FieldSet } from './field/FieldSet.js';
import {
  type CompositeUnique,
  type EntityDeclarations,
  type PreviousNames,
} from './entity/EntityDeclarations.js';
import { type EntityAdapters } from './entity/EntityAdapters.js';
import { EntityAdapterSet } from './entity/EntityAdapterSet.js';
import { SchemaDerivation } from './SchemaDerivation.js';
import { type ValidateOptions } from './validator/InputValidator.js';
import type { SchemaView } from './SchemaView.js';

/**
 * What a schema constrains beyond any single field.
 *
 * `unique` is the one member today. It sits under an owner rather than beside `fields`
 * and `opts` because the next rule spanning two fields — a check, an exclusion — is a
 * member here, not an eighth positional argument in a list that has already lost one.
 */
export class SchemaConstraints<TFields extends Fields = Fields> {
  readonly unique?: CompositeUnique<TFields>;

  private constructor(unique?: CompositeUnique<TFields>) {
    if (unique) this.unique = unique;
  }

  static readonly none = new SchemaConstraints();

  /**
   * The order is part of a group, so `['a','b']` and `['b','a']` are two constraints.
   * FR : l'ordre fait partie du groupe : `['a','b']` et `['b','a']` sont deux contraintes.
   * `SchemaConstraints.of([['a','b'], ['a','b']])` → `unique` holds one group
   */
  static of<TFields extends Fields>(
    groups: readonly (readonly FieldName<TFields>[])[],
  ): SchemaConstraints<TFields> {
    const seen = new Map<string, readonly FieldName<TFields>[]>();
    for (const group of groups) seen.set(JSON.stringify(group), group);

    return new SchemaConstraints(seen.size ? [...seen.values()] : undefined);
  }

  /** One member gone and the group is gone: it constrained a pair that no longer exists. */
  renamed(transform: (key: string) => string | undefined): SchemaConstraints {
    if (!this.unique) return SchemaConstraints.none;
    const kept: string[][] = [];
    for (const group of this.unique) {
      const renamed = group.map(transform);
      if (renamed.every((key): key is string => key !== undefined)) kept.push(renamed);
    }

    return SchemaConstraints.of(kept);
  }
}

/**
 * Everything a definition is made of, every member required.
 *
 * A transformation states what it keeps AND what it clears — `previous: undefined` and
 * `anchored: false` are the two a derivation decides, and positionally they were an
 * `undefined` and a `false` a reader had to count arguments to name.
 */
interface SchemaState {
  fields: Fields;
  adapterSet: EntityAdapterSet;
  opts: ValidateOptions;
  previous: PreviousNames<Fields> | undefined;
  derivation: SchemaDerivation | undefined;
  anchored: boolean;
  constraints: SchemaConstraints;
}

/** The keys a derivation keeps, in the order it keeps them, under the names they take. */
type Renaming = ReadonlyMap<string, string>;

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

  /**
   * A schema cut from another one: it carries no previous names and holds no rows of its
   * own, whatever else it keeps. `pick`, `partial`, `extend` and `compose` all land here.
   */
  private static derived(state: Omit<SchemaState, 'previous' | 'anchored'>): SchemaDefinition {
    return new SchemaDefinition({ ...state, previous: undefined, anchored: false });
  }

  /**
   * The same schema, one member restated — `declares` and `anchor`, which cut nothing.
   * What they do not name is kept, and that is the whole difference with `derived`.
   */
  private restated(state: Partial<SchemaState>): SchemaDefinition {
    return new SchemaDefinition({
      fields: this.fields,
      adapterSet: this.adapterSet,
      opts: this.opts,
      previous: this.previous,
      derivation: this.derivation,
      anchored: this.anchored,
      constraints: this.constraints,
      ...state,
    });
  }

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
    return new SchemaDefinition({
      fields: declaration.fields,
      adapterSet: EntityAdapterSet.of(declaration.adapters),
      opts: declaration.opts ?? {},
      previous: declaration.previous,
      derivation: declaration.derivation,
      anchored: declaration.anchored ?? false,
      constraints: declaration.constraints ?? SchemaConstraints.none,
    });
  }

  declaring(declarations: EntityDeclarations<Fields>): SchemaDefinition {
    const addressed = EntityAdapterSet.of(declarations.adapters).fieldNames;
    this.assertKnown('declares', [
      ...addressed,
      ...Object.keys(declarations.previous ?? {}),
    ]);
    const declared = FieldSet.declaring(this.fields, declarations.unique);

    return this.restated({
      fields: declared.fields,
      adapterSet: EntityAdapterSet.merged([
        this.adapterSet,
        EntityAdapterSet.of(declarations.adapters),
      ]),
      previous: declarations.previous ?? this.previous,
      constraints:
        declarations.unique === undefined
          ? this.constraints
          : SchemaConstraints.of(declared.groups),
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

  /**
   * `pick`, `omit` and `rename` are one gesture, and the renaming IS that gesture: the
   * fields it keeps and everything else addressed by field name are both read from it.
   */
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
    const groups: (readonly string[])[] = [];
    for (const view of views) {
      Object.assign(fields, view.getFields());
      opts = { ...opts, ...view.getOpts() };
      groups.push(...(view.getUnique() ?? []));
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

  /**
   * Refuses a gesture naming a field the schema does not carry, and lists what it does.
   * FR : refuse un geste nommant un champ absent, et énumère ceux qui existent.
   * `pick('titel')` → `pick(): unknown field \`titel\`. This schema carries id, title, body.`
   */
  private assertKnown(operation: string, keys: readonly string[]): void {
    const strangers = keys.filter((key) => !Object.hasOwn(this.fields, key));
    if (strangers.length === 0) return;

    throw new Error(
      `${operation}(): unknown field ${strangers.map((s) => `\`${s}\``).join(', ')}. ` +
        `This schema carries ${Object.keys(this.fields).join(', ')}.`,
    );
  }

  private origin(root: SchemaView): SchemaDerivation {
    if (!this.anchored && this.derivation) return this.derivation;

    return SchemaDerivation.first(root, this.fields);
  }
}
