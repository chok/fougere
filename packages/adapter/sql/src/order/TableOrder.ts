import type { TableDef } from '../table/TableDef.js';
import type { FkEdge } from './FkEdge.js';

export interface TableOrder {
  /** Tables in dependency order — a `ref()` target always precedes its referrer. */
  ordered: TableDef[];
  /** FK columns whose target could not be ordered first — a cycle. Constrain after creation. */
  deferred: FkEdge[];
}

/** Tables ordered so a `ref()`'s target exists before the table pointing at it. */
export function orderTables(tables: TableDef[]): TableOrder {
  const byName = new Map(tables.map((table) => [table.name, table]));
  const needs = new Map(
    tables.map((table) => [
      table.name,
      new Set(
        table.columns
          .filter((c) => c.references && c.references.table !== table.name && byName.has(c.references.table))
          .map((c) => c.references!.table),
      ),
    ]),
  );

  const ordered: TableDef[] = [];
  const deferred: FkEdge[] = [];
  const done = new Set<string>();

  while (needs.size > 0) {
    const ready = [...needs.keys()].find((name) => [...needs.get(name)!].every((dep) => done.has(dep)));
    if (ready) {
      ordered.push(byName.get(ready)!);
      done.add(ready);
      needs.delete(ready);
      continue;
    }
    const [name, deps] = [...needs.entries()][0];
    const dep = [...deps].find((d) => !done.has(d))!;
    const table = byName.get(name)!;
    for (const column of table.columns) {
      if (column.references?.table === dep) deferred.push({ table, column });
    }
    deps.delete(dep);
  }

  return { ordered, deferred };
}

/** The deferred foreign key columns of each table, by table name. */
export function deferredColumnsByTable(deferred: readonly FkEdge[]): Map<string, Set<string>> {
  const columns = new Map<string, Set<string>>();
  for (const { table, column } of deferred) {
    const names = columns.get(table.name) ?? new Set<string>();
    names.add(column.name);
    columns.set(table.name, names);
  }

  return columns;
}
