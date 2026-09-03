import { Boundary } from './axis/boundary/Boundary.js';
import { type Fields } from './fields/Field.js';
import {
  type CompositeUnique,
  type EntityDeclarations,
  type PreviousNames,
} from '../entity/EntityDeclarations.js';
import { type EntityAdapters } from '../entity/EntityAdapters.js';
import { EntityAdapterSet } from '../entity/EntityAdapterSet.js';
import { FieldGroup } from './fields/constraint/FieldGroup.js';
import { Unique } from './fields/constraint/Unique.js';
import { RowJudge } from '../judge/RowJudge.js';
import { SchemaDerivation } from './SchemaDerivation.js';
import { SchemaDefinition } from './SchemaDefinition.js';
import { type ValidateOptions } from '../judge/options.js';
import type { StandardSchemaV1 } from '../projection/standard.js';
import type { PartialRow, Row, SchemaView } from './SchemaView.js';

export const ANONYMOUS_SCHEMA_NAME = 'Schema';

export interface SchemaConstructor<TFields extends Fields> extends SchemaView<TFields> {
  new (data: PartialRow<TFields>): Row<TFields>;
  readonly '~standard': StandardSchemaV1.Props<Record<string, unknown>, Row<TFields>>;
  readonly derivation?: SchemaDerivation;
  readonly previous?: PreviousNames<TFields>;
  readonly anchored?: boolean;
  from(data: Record<string, unknown>): Row<TFields>;
  pick<K extends string & keyof TFields>(
    ...keys: K[]
  ): SchemaConstructor<Pick<TFields, K>>;
  omit<K extends string & keyof TFields>(
    ...keys: K[]
  ): SchemaConstructor<Omit<TFields, K>>;
  partial(): SchemaConstructor<TFields>;
  extend<E extends Fields>(extra: E): SchemaConstructor<TFields & E>;
  declares(declarations: EntityDeclarations<TFields>): SchemaConstructor<TFields>;
  anchor(): SchemaConstructor<TFields>;
  named(name: string): SchemaConstructor<TFields>;
  rename(
    mapping: Partial<Record<string & keyof TFields, string>>,
  ): SchemaConstructor<Fields>;
}

export class Schema {
  /** The one place a schema holds what it is. The readings below are its projections. */
  static definition: SchemaDefinition = SchemaDefinition.of({ fields: {} });

  /**
   * So the judge, the adapters and every derivation read one same field set.
   * FR : pour que le juge, les adaptateurs et chaque dérivation lisent un seul et même ensemble.
   * `Post.fields` → the definition's fields, never a copy
   */
  static get fields(): Fields {
    return this.definition.fields;
  }
  /**
   * So an adapter's entry is carried by every derivation that kept the field.
   * FR : pour que l'entrée d'un adaptateur soit portée par toute dérivation qui garde le champ.
   * `Post.pick('body').adapters` → still `{ sql: { body: … } }`
   */
  static get adapters(): EntityAdapters<Fields> {
    return this.definition.adapterSet.adapters;
  }
  /**
   * So the judging mode travels with the schema and not with the call.
   * FR : pour que le mode de jugement voyage avec le schéma, et pas avec l'appel.
   * `Post.partial().opts` → `{ patch: true }`
   */
  static get opts(): ValidateOptions {
    return this.definition.opts;
  }
  /**
   * So a cut schema can say what it was cut from.
   * FR : pour qu'un schéma coupé puisse dire de quoi il a été coupé.
   * `Post.pick('title').derivation.sourceName` → `'Post'`
   */
  static get derivation(): SchemaDerivation | undefined {
    return this.definition.derivation;
  }
  /**
   * So a migration learns what a field used to be called.
   * FR : pour qu'une migration apprenne comment un champ s'appelait avant.
   * `declares({ previous: { text: 'body' } })` → `Post.previous` → `{ text: 'body' }`
   */
  static get previous(): PreviousNames<Fields> | undefined {
    return this.definition.previous;
  }
  /**
   * So a walk knows where to stop: an anchor holds rows, a derivation borrows them.
   * FR : pour qu'un parcours sache où s'arrêter : une ancre tient des lignes.
   * `Post.anchored` → `true`; `Post.pick('title').anchored` → `false`
   */
  static get anchored(): boolean {
    return this.definition.anchored;
  }

  /**
   * So `new Post({ … })` gives a row whose keys are its own.
   * FR : pour que `new Post({ … })` donne une ligne dont les clés lui appartiennent.
   * `Object.keys(new Post({ title: 'a' }))` → `['title']`
   */
  constructor(data?: Record<string, unknown>) {
    if (!data) return;
    for (const [key, value] of Object.entries(data)) {
      Object.defineProperty(this, key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
  }

  /**
   * So every reader is written against `SchemaView`, never against this class.
   * FR : pour que chaque lecteur soit écrit contre `SchemaView`, jamais contre cette classe.
   * `Post.getFields()` → the same object as `Post.fields`
   */
  static getFields() {
    return this.fields;
  }
  /**
   * So an adapter goes through the contract, not through a static of this class.
   * FR : pour qu'un adaptateur passe par le contrat, pas par un statique de cette classe.
   * `Post.getAdapters().sql`
   */
  static getAdapters() {
    return this.adapters;
  }
  /**
   * So the groups come back as the lists they were declared as.
   * FR : pour que les groupes reviennent sous forme des listes déclarées.
   * `User.getUnique()` → `[['email', 'tenant']]`
   */
  static getUnique(): CompositeUnique<Fields> | undefined {
    const groups = FieldGroup.groupsOf(this.fields, Unique);
    return groups.length ? groups.map((group) => [...group.members]) : undefined;
  }
  /**
   * So `Post.partial()` carries its own `{ patch: true }`.
   * FR : pour que `Post.partial()` transporte son propre `{ patch: true }`.
   * `Post.partial().getOpts()` → `{ patch: true }`
   */
  static getOpts() {
    return this.opts;
  }

  /**
   * So a client's input is judged by the schema itself, in one call.
   * FR : pour que l'entrée d'un client soit jugée par le schéma lui-même, en un appel.
   * `Post.validate({ ghost: 1 })` → `{ success: false, errors: [{ path: 'ghost', … }] }`
   */
  static validate(input: unknown) {
    return RowJudge.of(this.fields, this.opts).validate(input);
  }

  /**
   * So a row read from a wire or a table arrives decoded.
   * FR : pour qu'une ligne lue d'un fil ou d'une table arrive décodée.
   * `Post.from({ createdAt: '2026-01-01' })` → `createdAt` is a `Date`
   */
  static from(data: Record<string, unknown>) {
    const out: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(this.fields)) {
      if (!(key in data)) continue;
      const value = data[key];
      if (value === null || value === undefined) {
        out[key] = value;
        continue;
      }
      const decoded = Boundary.of(field).decode(value);
      out[key] = 'error' in decoded ? value : decoded.value;
    }
    return out;
  }

  /**
   * So a library that speaks Standard Schema takes an entity as is.
   * FR : pour qu'une bibliothèque parlant Standard Schema prenne une entité telle quelle.
   * `Post['~standard'].validate({ ghost: 1 })` → `{ issues: [{ message: 'Unknown field' }] }`
   */
  static get ['~standard'](): StandardSchemaV1.Props<Record<string, unknown>> {
    const { fields, opts } = this;
    return {
      version: 1,
      vendor: 'fougere',
      validate(value: unknown) {
        const result = RowJudge.of(fields, opts).validate(value);
        if (result.success) return { value: result.data };
        return {
          issues: result.errors.map((e) => ({
            message: e.message,
            path: e.path && e.path !== '.' ? [{ key: e.path }] : undefined,
          })),
        };
      },
    };
  }

  /**
   * So a view over an entity is a schema, and a typo is refused.
   * FR : pour qu'une vue sur une entité soit un schéma, et qu'une faute de frappe soit refusée.
   * `Post.pick('titel')` → throws `pick(): unknown field \`titel\`. This schema carries id, title.`
   */
  static pick(...keys: string[]) {
    assertKnownKeys('pick', keys, this.fields);
    const picked: Fields = {};
    for (const key of keys) if (this.fields[key]) picked[key] = this.fields[key];
    return this.derive(picked, (k) => (keys.includes(k) ? k : undefined));
  }

  /**
   * So the dual of `pick` reads and refuses the same.
   * FR : pour que le dual de `pick` se lise et refuse pareil.
   * `Post.omit('secret')` → every other field, still anchored on `Post`
   */
  static omit(...keys: string[]) {
    assertKnownKeys('omit', keys, this.fields);
    const kept: Fields = {};
    for (const [key, field] of Object.entries(this.fields))
      if (!keys.includes(key)) kept[key] = field;
    return this.derive(kept, (k) => (keys.includes(k) ? undefined : k));
  }

  /**
   * So a field changes name and what the entity said about it follows.
   * FR : pour qu'un champ change de nom et que ce que l'entité disait de lui suive.
   * `Post.rename({ body: 'text' })` → `adapters.sql.body` becomes `adapters.sql.text`
   */
  static rename(mapping: Record<string, string>) {
    assertKnownKeys('rename', Object.keys(mapping), this.fields);
    const renamed: Fields = {};
    for (const [key, field] of Object.entries(this.fields))
      renamed[mapping[key] ?? key] = field;
    return this.derive(renamed, (k) => mapping[k] ?? k);
  }

  /**
   * So an entity states `unique`, `previous` and `adapters` wherever a schema is.
   * FR : pour qu'une entité énonce `unique`, `previous` et `adapters` où qu'un schéma soit.
   * `Post.declares({ unique: [['email', 'tenant']] })`
   */
  static declares(declarations: EntityDeclarations<Fields>) {
    const addressed = EntityAdapterSet.of(declarations.adapters).fieldNames;
    assertKnownKeys(
      'declares',
      [...addressed, ...Object.keys(declarations.previous ?? {})],
      this.fields,
    );

    return Schema.subclass(this.definition.declaring(declarations));
  }

  /**
   * So a derivation can declare that it holds rows of its own.
   * FR : pour qu'une dérivation déclare qu'elle tient ses propres lignes.
   * `Post.pick('id', 'title').anchor()` → `anchored` is `true`
   */
  static anchor() {
    return Schema.subclass(this.definition.anchoring());
  }

  /**
   * So a patch is judged by a schema that says so.
   * FR : pour qu'une modification partielle soit jugée par un schéma qui le dit.
   * `Post.partial().validate({ title: 'a' })` → no `Required` on what is absent
   */
  static partial() {
    return Schema.subclass(this.definition.patched(this));
  }

  /**
   * So fields are added without restating the ones already there.
   * FR : pour qu'on ajoute des champs sans redire ceux déjà présents.
   * `Post.extend({ slug: text() })` → `Post`'s fields plus `slug`
   */
  static extend(extra: Fields) {
    return Schema.subclass(this.definition.extended(extra, this));
  }

  /**
   * So a derived schema gets the name a card will carry — once.
   * FR : pour qu'un schéma dérivé reçoive le nom que portera une carte — une seule fois.
   * `Post.pick('title').named('PostCard')`; naming it again throws
   */
  static named(name: string) {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
      throw new Error(`named(): \`${name}\` is not a valid class name.`);
    }
    if (this.name !== ANONYMOUS_SCHEMA_NAME) {
      throw new Error(
        `named(): \`${this.name}\` is already named by its class declaration.`,
      );
    }
    Object.defineProperty(this, 'name', { value: name, configurable: true });
    return this;
  }

  /**
   * So several schemas become one, a key claimed twice being refused.
   * FR : pour que plusieurs schémas n'en fassent qu'un, une clé prise deux fois étant refusée.
   * `Schema.compose(Timestamps, Post)` → one schema carrying both field sets
   */
  static compose<T extends SchemaView[]>(...sources: T): SchemaConstructor<Merged<T>> {
    return Schema.subclass(
      SchemaDefinition.merged(sources),
    ) as unknown as SchemaConstructor<Merged<T>>;
  }

  /**
   * So a card read back becomes a schema class.
   * FR : pour qu'une carte relue devienne une classe de schéma.
   * `Schema.of({ fields: { id: primary() } })` → a schema class with one field
   */
  static of<TFields extends Fields>(declaration: {
    fields: TFields;
    derivation?: SchemaDerivation;
    adapters?: EntityAdapters<TFields>;
    opts?: ValidateOptions;
    previous?: PreviousNames<TFields>;
    anchored?: boolean;
  }): SchemaConstructor<TFields> {
    return Schema.subclass(
      SchemaDefinition.of(declaration),
    ) as unknown as SchemaConstructor<TFields>;
  }

  /**
   * So every derivation is born the same way, the definition alone differing.
   * FR : pour que chaque dérivation naisse pareil, seule la définition changeant.
   * `subclass(def)` → an anonymous `Schema` subclass carrying `def`
   */
  private static subclass(definition: SchemaDefinition): SchemaConstructor<Fields> {
    class Derived extends Schema {}
    Derived.definition = definition;
    Object.defineProperty(Derived, 'name', {
      value: ANONYMOUS_SCHEMA_NAME,
      configurable: true,
    });
    return Derived as unknown as SchemaConstructor<Fields>;
  }

  /**
   * So `pick`, `omit` and `rename` differ only by which fields remain, and under what name.
   * FR : pour que `pick`, `omit` et `rename` ne diffèrent que par les champs restants et leur nom.
   * `derive(picked, (k) => keys.includes(k) ? k : undefined)`
   */
  private static derive(fields: Fields, transform: (key: string) => string | undefined) {
    return Schema.subclass(this.definition.derived(fields, transform, this));
  }
}

/**
 * So a gesture naming a field that does not exist says so, and lists what there is.
 * FR : pour qu'un geste nommant un champ inexistant le dise, et énumère ce qui existe.
 * `pick('titel')` → `pick(): unknown field \`titel\`. This schema carries id, title, body.`
 */
function assertKnownKeys(operation: string, keys: string[], fields: Fields): void {
  const strangers = keys.filter((key) => !(key in fields));
  if (strangers.length === 0) return;
  throw new Error(
    `${operation}(): unknown field ${strangers.map((s) => `\`${s}\``).join(', ')}. ` +
      `This schema carries ${Object.keys(fields).join(', ')}.`,
  );
}

type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;
type Merged<T extends SchemaView[]> = UnionToIntersection<
  T[number] extends { getFields(): infer F } ? F : Fields
> &
  Fields;
