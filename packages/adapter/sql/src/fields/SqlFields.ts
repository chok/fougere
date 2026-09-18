/**
 * What an entity may state for THIS adapter, declared from OUTSIDE `@fougere/schema` — which names
 * no engine and no column type, and must not learn one to let this exist.
 */
import { Format, JsonSchemaValidator, type JsonSchema } from '@fougere/schema';
import { ENGINES } from './Engine.js';
import type { SqlField } from './SqlField.js';

/** What sql holds, addressed by field — the shape every augmentation of the registry takes. */
export type SqlFields<K extends string> = Readonly<Partial<Record<K, SqlField>>>;

const ENTRY_FORMAT = Format.of('https://fougere.dev/schema/adapter/sql')
  .key(
    'columnType',
    ENGINES.reduce((held, engine) => held.key(engine, Format.text), Format.of()).closed(),
  )
  .closed();

/** Judges what an entity states under `adapters.sql`: the format this adapter ships, keyed by field. */
export const sqlEntries = JsonSchemaValidator.of({
  type: 'object',
  additionalProperties: ENTRY_FORMAT.schema as JsonSchema,
});

declare module '@fougere/schema' {
  interface FougereEntityAdapters<K extends string> {
    sql?: SqlFields<K>;
  }
}
