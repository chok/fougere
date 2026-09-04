import type { Field, Fields } from './field/Field.js';
import type { CompositeUnique, PreviousNames } from './entity/EntityDeclarations.js';
import type { EntityAdapters } from './entity/EntityAdapters.js';
import type { ValidationResult } from './judge/result.js';
import type { ValidateOptions } from './judge/options.js';
import type { SchemaDerivation } from './SchemaDerivation.js';

export type Row<TFields extends Fields> = {
  [K in keyof TFields]: TFields[K] extends Field<infer T> ? T : never;
};

export type PartialRow<TFields extends Fields> = Partial<Row<TFields>>;

export interface SchemaView<TFields extends Fields = Fields> {
  readonly name: string;
  /** What this schema was cut from, when it was cut from anything. */
  readonly derivation?: SchemaDerivation;
  /** What its fields were called before, keyed by the names they carry now. */
  readonly previous?: PreviousNames<TFields>;
  /** Does it hold rows of its own? False on a derivation means an answer. */
  readonly anchored?: boolean;
  /**
   * So every reader — adapter, judge, card — asks the schema and never the class body.
   * FR : pour que chaque lecteur interroge le schéma, jamais le corps de la classe.
   * `Post.getFields()` → `{ id: Field, title: Field, … }`
   */
  getFields(): TFields;
  /**
   * So an adapter reads what the entity said to IT, and learns nothing about the others.
   * FR : pour qu'un adaptateur lise ce qui lui est adressé, et rien des autres.
   * `Post.getAdapters().sql` → `{ body: { columnType: 'tsvector' } }`
   */
  getAdapters(): EntityAdapters<TFields>;
  /**
   * So a DDL learns the groups without walking every field to collect them.
   * FR : pour qu'un DDL apprenne les groupes sans parcourir chaque champ.
   * `User.getUnique()` → `[['email', 'tenant']]`
   */
  getUnique(): CompositeUnique<TFields> | undefined;
  /**
   * So a partial schema carries its own judging mode, instead of each caller passing it along.
   * FR : pour qu'un schéma partiel porte son mode de jugement.
   * `Post.partial().getOpts()` → `{ patch: true }`
   */
  getOpts(): ValidateOptions;
  /**
   * So one gesture answers for a whole row, and the schema is the only judge there is.
   * FR : pour qu'un geste réponde pour une ligne entière, le schéma étant seul juge.
   * `Post.validate({ ghost: 1 })`
   * → `{ success: false, errors: [{ path: 'ghost', message: 'Unknown field' }] }`
   */
  validate(input: unknown): ValidationResult<Row<TFields>>;
}
