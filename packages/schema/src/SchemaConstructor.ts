import { type Fields } from './field/Fields.js';

import { type EntityDeclarations } from './entity/EntityDeclarations.js';
import { type PreviousNames } from './entity/PreviousNames.js';
import { SchemaDerivation } from './SchemaDerivation.js';
import type { StandardSchemaV1 } from './projection/standard.js';
import type { PartialValues } from './PartialValues.js';
import type { SchemaView } from './SchemaView.js';
import type { Values } from './Values.js';

export interface SchemaConstructor<TFields extends Fields> extends SchemaView<TFields> {
  new (data: PartialValues<TFields>): Values<TFields>;
  readonly '~standard': StandardSchemaV1.Props<Record<string, unknown>, Values<TFields>>;
  readonly derivation?: SchemaDerivation;
  readonly previous?: PreviousNames<TFields>;
  readonly anchored?: boolean;
  from(data: Record<string, unknown>): Values<TFields>;
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
