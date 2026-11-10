import { lowerFirst, Role, type SchemaView } from '@fougere/schema';
import type { EntityEntry } from './descriptor/EntityEntry.js';
import { tablesOf } from './descriptor/tables.js';
import FougereTarget, { FOUGERE_TARGET } from './module/relation/FougereTarget.js';

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
  const all = tablesOf(fronds).tables;
  if (!holds) return { entities: all };
  const held = new Map([...all].filter(([name]) => holds(name)));
  const entities = namesElsewhere(held, holds) ? new Map([...held, [FOUGERE_TARGET, FougereTarget as SchemaView]]) : held;

  return {
    entities,
    inOtherSources: [...all.keys()].filter((name) => !holds(name)).sort(),
  };
}

function namesElsewhere(held: ReadonlyMap<string, SchemaView>, holds: (name: string) => boolean): boolean {
  return [...held.values()].some((schema) => Object.values(schema.getFields()).some((field) => {
    const role = Role.of(field);

    return role.isReference() && !holds(lowerFirst(role.target?.name ?? ''));
  }));
}

/**
 * Whether one source holds both rows and keeps the relation between them as a foreign key.
 *
 * Documented: [entities](https://fougere.dev/docs/concepts/entity).
 */
export function hasForeignKey(
  namer: string,
  target: string,
  sourceOf: (entity: string) => string | undefined,
  enforces: (source: string) => boolean,
): boolean {
  const source = sourceOf(namer);

  return source !== undefined && source === sourceOf(target) && enforces(source);
}
