/**
 * What an entity may state for THIS adapter, declared from OUTSIDE `@fougere/schema` —
 * which names no engine and no column type, and must not learn one to let this exist.
 *
 * It replaces what the shape would have given, and only for the engine it names: an
 * engine absent here keeps the shape's answer, so the entity still boots on every
 * dialect. What an engine must HONOR is not stated here — it is a decision, and it
 * belongs in `fougere.config.ts` beside `remotes:`, `sources:` and `ports:`.
 *
 * The format is stated ONCE, as data, in `adapter.schema.json` beside this file: the
 * interface below is derived from it, and `EntryJudge` reads the same file at boot. A
 * TypeScript interface alone is erased before anything could judge what a JS caller, a
 * config or a card from another language wrote.
 */
import { Adapters, type Shape } from '@fougere/schema';
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

/**
 * Registers this adapter under the name an entity addresses it by, and takes back the judge
 * of its own entries — so the name is a datum, not something implicit in whoever reads it.
 * FR : enregistre l'adaptateur sous le nom qui l'adresse, et reprend le juge de ses entrées.
 * `sqlEntries.check({ body: { columnTpye: {} } }, 'Post.adapters.sql')`
 * → throws `Post.adapters.sql.body: Property "columnTpye" does not match …`
 */
export const sqlEntries = Adapters.register('sql', ENTRY_FORMAT as Shape);

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
