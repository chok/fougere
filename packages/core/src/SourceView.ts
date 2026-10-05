import type { SchemaView } from '@fougere/schema';
import type { EntityEntry } from './descriptor/EntityEntry.js';

/** The app as ONE source sees it: the entities it holds, by the name the scan wrote down. */
export interface SourceView {
  entities: ReadonlyMap<string, SchemaView>;
  /** The names another source holds — a reference to one gets a column and no key. Absent: all here. */
  elsewhere?: readonly string[];
}

/** What a source holds of these fronds — every entity, or the ones `holds` keeps and the rest named. */
export function sourceViewOf(
  fronds: readonly { readonly entities: readonly Pick<EntityEntry, 'name' | 'entityClass'>[] }[],
  holds?: (name: string) => boolean,
): SourceView {
  const all = new Map(fronds.flatMap((frond) => frond.entities.map((entry) => [entry.name, entry.entityClass] as const)));
  if (!holds) return { entities: all };

  return {
    entities: new Map([...all].filter(([name]) => holds(name))),
    elsewhere: [...all.keys()].filter((name) => !holds(name)).sort(),
  };
}
