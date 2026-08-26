/**
 * What this adapter accepts as a hint, declared from OUTSIDE `@fougere/schema` — which
 * names no engine and no column type, and must not learn one to let this exist.
 *
 * A hint is a PREFERENCE. An engine with no spelling for it emits the type the shape
 * would have given, silently: the entity still boots on every dialect. What an engine
 * must honor is not a hint — it is a decision, and it belongs in `fougere.config.ts`
 * beside `remotes:`, `sources:` and `ports:`.
 */
import type { DialectName } from './dialect.js';

export interface SqlFieldHint {
  /** The column type to emit, per engine. An engine absent here keeps the shape's own. */
  columnType?: Partial<Record<DialectName, string>>;
}

declare module '@fougere/schema' {
  interface FougereHints<K extends string> {
    sql?: Partial<Record<K, SqlFieldHint>>;
  }
}
