import type { SchemaView } from '@fougere/schema';
import type { EntityEntry } from './descriptor/EntityEntry.js';
import { tablesOf } from './descriptor/tables.js';

/** The app as ONE source sees it: the entities it holds, by the name the scan wrote down. */
export interface SourceView {
  entities: ReadonlyMap<string, SchemaView>;
  /** The names another source holds — a reference to one gets a column and no key. Absent: all here. */
  inOtherSources?: readonly string[];
}

/** What a source holds of these fronds — every entity, or the ones `holds` keeps and the rest named. */
export function sourceViewOf(
  fronds: readonly { readonly name?: string; readonly entities: readonly Pick<EntityEntry, 'name' | 'entityClass'>[] }[],
  holds?: (name: string) => boolean,
): SourceView {
  // The table each name is — the union of what the fronds declaring it say, not the last one read.
  const all = tablesOf(fronds).tables;
  if (!holds) return { entities: all };

  return {
    entities: new Map([...all].filter(([name]) => holds(name))),
    inOtherSources: [...all.keys()].filter((name) => !holds(name)).sort(),
  };
}
