/**
 * What an entity may state for THIS adapter, declared from OUTSIDE `@fougere/schema` —
 * which names no engine and no column type, and must not learn one to let this exist.
 *
 * It replaces what the shape would have given, and only for the engine it names: an
 * engine absent here keeps the shape's answer, so the entity still boots on every
 * dialect. What an engine must HONOR is not stated here — it is a decision, and it
 * belongs in `fougere.config.ts` beside `remotes:`, `sources:` and `ports:`.
 */
import type { DialectName } from './dialect.js';

/** What sql holds, addressed by field — the shape every augmentation of the registry takes. */
export type SqlFields<K extends string> = Partial<Record<K, SqlField>>;

export interface SqlField {
  /** The column type to emit, per engine. An engine absent here keeps the shape's own. */
  columnType?: Partial<Record<DialectName, string>>;
}

declare module '@fougere/schema' {
  interface FougereEntityAdapters<K extends string> {
    sql?: SqlFields<K>;
  }
}
