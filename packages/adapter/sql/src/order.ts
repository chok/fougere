/**
 * In what order a batch of tables is created — the one question that reads a `TableDef` and
 * knows nothing above it: no entity, no axis, no schema.
 */
import type { ColumnDef, TableDef } from './table.js';

export interface FkEdge {
  table: TableDef;
  column: ColumnDef;
}

export interface TableOrder {
  /** Tables in dependency order — a `ref()` target always precedes its referrer. */
  ordered: TableDef[];
  /** FK columns whose target could not be ordered first — a cycle. Constrain after creation. */
  deferred: FkEdge[];
}

/**
 * Order a table set so a `ref()`'s target always exists before the table that
 * points at it — required by every engine except SQLite, which resolves FK
 * targets lazily and accepts any order (and has no `ALTER TABLE ADD CONSTRAINT`
 * to close a cycle with — a caller on that dialect skips this function entirely).
 *
 * A cycle (`Post → Author → Post`, legal in the model — role.ts's relation
 * thunk exists precisely so two entities can reference each other) has no such
 * order: the loop is broken by deferring ONE of its edges per remaining cycle —
 * that FK is added after every table exists, instead of inline. A self-reference
 * (`parentId: ref(() => Category)`) is not a cycle here: a table may always
 * reference its own not-yet-populated rows inline, standard support across
 * every engine — so it's excluded from the dependency graph entirely.
 */
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
    // Every table left waits on another table left — a cycle. Break it by
    // deferring one edge: every column of the first remaining table that points
    // at its first unmet dependency.
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
