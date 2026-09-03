import { type Fields } from './fields/Field.js';
import { FieldSet } from './fields/FieldSet.js';
import {
  type EntityDeclarations,
  type PreviousNames,
} from '../entity/EntityDeclarations.js';
import { type EntityAdapters } from '../entity/EntityAdapters.js';
import { EntityAdapterSet } from '../entity/EntityAdapterSet.js';
import { SchemaDerivation } from './SchemaDerivation.js';
import { type ValidateOptions } from '../judge/options.js';
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

  /**
   * So a definition is built complete or not at all, instead of statics assigned side by side.
   * FR : pour qu'une définition soit construite complète ou pas du tout.
   * `SchemaDefinition.stated({ fields })` → opts `{}`, anchored `false`, the rest undefined
   */
  static stated(said: {
    fields: Fields;
    adapters?: EntityAdapters<Fields>;
    opts?: ValidateOptions;
    previous?: PreviousNames<Fields>;
    derivation?: SchemaDerivation;
    anchored?: boolean;
  }): SchemaDefinition {
    return new SchemaDefinition(
      said.fields,
      EntityAdapterSet.of(said.adapters),
      said.opts ?? {},
      said.previous,
      said.derivation,
      said.anchored ?? false,
    );
  }

  /**
   * So what a schema says about itself folds into what it already said, without losing either.
   * FR : pour que ce qu'un schéma dit de lui se replie dans ce qu'il disait.
   * `declaring({ unique: [['email', 'tenant']] })` → both fields now carry the group
   */
  declaring(said: EntityDeclarations<Fields>): SchemaDefinition {
    return new SchemaDefinition(
      FieldSet.declared(this.fields, said.unique),
      EntityAdapterSet.merged([this.adapterSet, EntityAdapterSet.of(said.adapters)]),
      this.opts,
      said.previous ?? this.previous,
      this.derivation,
      this.anchored,
    );
  }

  /**
   * So a derivation can stop being an answer and start holding rows, changing nothing else.
   * FR : pour qu'une dérivation cesse d'être une réponse et tienne des lignes.
   * `Post.pick('id', 'title').anchor()` → same fields, `anchored: true`
   */
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

  /**
   * So `pick`, `omit` and `rename` are one gesture: what remains, and what became of each name.
   * FR : pour que `pick`, `omit` et `rename` soient un geste : ce qui reste, sous quel nom.
   * `derived(kept, (k) => k === 'body' ? 'text' : k, Post)`
   * → fields renamed, adapter entries re-addressed, origin composed
   */
  derived(
    fields: Fields,
    survives: (key: string) => string | undefined,
    root: SchemaView,
  ): SchemaDefinition {
    const renamed: Fields = {};
    for (const [key, field] of Object.entries(fields))
      renamed[key] = field.rename(survives);
    return new SchemaDefinition(
      renamed,
      this.adapterSet.mapFields(survives),
      this.opts,
      undefined,
      this.origin(root).compose(survives),
      false,
    );
  }

  /**
   * So the same fields judge an update, and the mode is a property of the schema, not of a call.
   * FR : pour que le mode de jugement soit une propriété du schéma, pas de l'appel.
   * `Post.partial()` → `opts.patch` is `true`, fields untouched
   */
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

  /**
   * So an added field does not pretend to come from the root, which never declared it.
   * FR : pour qu'un champ ajouté ne prétende pas venir de la racine.
   * `Post.extend({ slug: text() })` → the derivation still speaks of `Post` alone
   */
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

  /**
   * So several schemas fold into one, which by construction has no single origin to name.
   * FR : pour que plusieurs schémas n'en fassent qu'un, sans origine unique.
   * `merged([Timestamps, Post])` → both field sets, `derivation` undefined
   */
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

  /**
   * So what is cut from an anchor roots on that anchor, and not on where the anchor came from.
   * FR : pour que ce qui est coupé d'une ancre s'enracine sur elle.
   * `Post.pick('id').anchor().pick('id')` → the origin is the anchored schema, not `Post`
   */
  private origin(root: SchemaView): SchemaDerivation {
    if (!this.anchored && this.derivation) return this.derivation;

    return SchemaDerivation.first(root, this.fields);
  }
}
