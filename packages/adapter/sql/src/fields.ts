/** What an entity may state for THIS adapter, declared from OUTSIDE `@fougere/schema` — which names… */
import { EntryJudge, type Shape } from '@fougere/schema';
import ENTRY_FORMAT from './adapter.schema.json' with { type: 'json' };
import type { DialectName } from './dialect.js';

/** The engines the format names — the one list, read off the file that states it. */
type Engine = keyof typeof ENTRY_FORMAT.properties.columnType.properties;

/** What sql holds, addressed by field — the shape every augmentation of the registry takes. */
export type SqlFields<K extends string> = Readonly<Partial<Record<K, SqlField>>>;

export interface SqlField {
  /** The column type to emit, per engine. An engine absent here keeps the shape's own. */
  readonly columnType?: Readonly<Partial<Record<Engine, string>>>;
}

/** Judges what an entity states under `adapters.sql`, against the format this adapter ships. */
export const sqlEntries = EntryJudge.of(ENTRY_FORMAT as Shape);

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
