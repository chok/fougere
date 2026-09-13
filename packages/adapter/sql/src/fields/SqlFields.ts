/**
 * What an entity may state for THIS adapter, declared from OUTSIDE `@fougere/schema` — which names
 * no engine and no column type, and must not learn one to let this exist.
 */
import { AdapterFieldValidator, type Shape } from '@fougere/schema';
import ENTRY_FORMAT from '../adapter.schema.json' with { type: 'json' };
import type { DialectName } from '../dialect/DialectName.js';
import type { SqlField } from './SqlField.js';
import type { Engine } from './Engine.js';

/** What sql holds, addressed by field — the shape every augmentation of the registry takes. */
export type SqlFields<K extends string> = Readonly<Partial<Record<K, SqlField>>>;

/** Judges what an entity states under `adapters.sql`, against the format this adapter ships. */
export const sqlEntries = AdapterFieldValidator.of(ENTRY_FORMAT as Shape);

type Assert<T extends true> = T;

/** A fifth dialect does not compile until `adapter.schema.json` names it. */
type _EnginesMatchDialects = Assert<
  [Exclude<DialectName, Engine>] extends [never] ? true : false
>;

declare module '@fougere/schema' {
  interface FougereEntityAdapters<K extends string> {
    sql?: SqlFields<K>;
  }
}
