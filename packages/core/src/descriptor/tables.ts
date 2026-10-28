import { entity, optional, type Field, type SchemaView } from '@fougere/schema';
import type { EntityEntry } from './EntityEntry.js';

/** Two fronds declaring one field of a table differently — one column has one shape. */
export interface Contradiction {
  entity: string;
  field: string;
  fronds: readonly [string, string];
  /** Where the second declaration is — what a refusal names. */
  filePath: string;
}

/**
 * What each entity name is in this process: its TABLE, the union of what every frond declaring it
 * says. A frond declares the fields it cares about — a view — and the table holds them all, so two
 * `Author`s of different fields are two views of one table, not a conflict. A field some declaring
 * frond leaves out is optional in the table: what is required is each frond's to judge on its own
 * writes. A field two fronds declare differently is a contradiction, which the boot refuses.
 */
export function tablesOf(
  fronds: readonly { readonly name?: string; readonly entities: readonly (Pick<EntityEntry, 'name' | 'entityClass'> & { filePath?: string })[] }[],
): { tables: Map<string, SchemaView>; contradictions: Contradiction[] } {
  const declaredBy = new Map<string, { frond: string; schema: SchemaView; filePath: string }[]>();
  for (const frond of fronds) {
    for (const { name, entityClass, filePath } of frond.entities) {
      const views = declaredBy.get(name) ?? [];
      if (!views.some((view) => view.schema === entityClass)) views.push({ frond: frond.name ?? 'a frond', schema: entityClass, filePath: filePath ?? '' });
      declaredBy.set(name, views);
    }
  }

  const contradictions: Contradiction[] = [];
  const tables = new Map<string, SchemaView>();
  for (const [name, views] of declaredBy) {
    if (views.length === 1) {
      tables.set(name, views[0]!.schema);
      continue;
    }
    const columns = new Map<string, { frond: string; field: Field }>();
    const everywhere = (field: string) => views.every((view) => field in view.schema.getFields());
    for (const view of views) {
      for (const [key, field] of Object.entries(view.schema.getFields()) as [string, Field][]) {
        const known = columns.get(key);
        if (!known) {
          columns.set(key, { frond: view.frond, field });
        } else if (shapeOf(known.field) !== shapeOf(field)) {
          contradictions.push({ entity: name, field: key, fronds: [known.frond, view.frond], filePath: view.filePath });
        }
      }
    }
    const fields = Object.fromEntries([...columns].map(([key, { field }]) => [key, everywhere(key) ? field : optional(field)]));
    const table = entity(fields as never);
    Object.defineProperty(table, 'name', { value: (views[0]!.schema as { name?: string }).name ?? name });
    tables.set(name, table as unknown as SchemaView);
  }

  return { tables, contradictions };
}

/** What a column is: the field's shape and its axes — a relation by the NAME of its target, a function compared by nothing else. */
function shapeOf(field: Field): string {
  return JSON.stringify(field, (key, value: unknown) =>
    typeof value === 'function' ? (value as () => { name?: string })().name ?? 'anonymous' : value);
}
