/**
 * Entity → table description, with no SQL in sight.
 *
 * This is the neutral middle term: one projection reads the entity's axes and
 * produces a `TableDef`; a `Dialect` turns that into SQL. Neither half knows the
 * other — the entity never mentions a column type, the dialect never mentions a
 * field. Adding a dialect touches only the second half.
 */
import { anatomy, type AnyField, type SchemaLike } from '@fougere/schema';

/** The shape keywords a dialect needs to choose a column type. */
export interface ColumnShape {
  type?: string;
  format?: string;
  maxLength?: number;
}

/** One column, described by the axes — never by a SQL type. */
export interface ColumnDef {
  /** Field key on the entity. */
  field: string;
  /** SQL column name (snake_case). */
  name: string;
  /** The value shape, nullable union already unwrapped. */
  shape?: ColumnShape;
  nullable: boolean;
  primary: boolean;
  /** A literal default (`lifecycle.create.value`), when the field declares one. */
  default?: unknown;
  /** The FK target, from `role.relation` when it's a `ref()` (kind `'one'`). */
  references?: ColumnReference;
}

export interface ColumnReference {
  table: string;
  column: string;
  onDelete?: 'cascade' | 'restrict' | 'set null';
}

export interface TableDef {
  name: string;
  columns: ColumnDef[];
  /** PK column names when the key is composite — empty for a simple key. */
  compositePrimary: string[];
}

/** camelCase → snake_case */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * A `many` relation owns no column — the join lives on the other side. Every
 * other field becomes exactly one column.
 */
function isStored(field: AnyField): boolean {
  return field.role?.relation?.kind !== 'many';
}

/**
 * PascalCase class name → the registration key every table name is resolved
 * from elsewhere in this package (mirrors `@fougere/core`'s scanner convention;
 * kept local so schema-sql stays decoupled from core: `'Category'` → `'category'`).
 * A no-op on an already-lowercased name — what a relation reconstructed from a
 * lone card falls back to (see {@link primaryColumnOf}'s doc).
 */
function registrationName(className: string): string {
  return className ? className[0].toLowerCase() + className.slice(1) : className;
}

/**
 * The target's primary key column. A live thunk (an in-process entity) answers
 * for real; a relation reconstructed from a lone card (`reconstruct()`, no
 * bundle — `packages/schema/src/projections/card.ts:18-22`) has lost it to a
 * name stand-in with no `getFields` — the convention there is to assume `id`.
 */
function primaryColumnOf(target: Partial<SchemaLike>): string {
  if (typeof target.getFields !== 'function') return 'id';
  for (const [name, field] of Object.entries(target.getFields())) {
    if (field.role?.primary) return toSnakeCase(name);
  }
  return 'id'; // declared no primary() field — defensive, shouldn't happen
}

/**
 * The FK target for a `ref()` field: the table it points at plus its PK column.
 *
 * `tableNameOf` is an identity map — built once per app generation pass, see
 * {@link toTables} — from a LIVE entity class to the table name already resolved
 * for it. Reusing that name (instead of re-deriving one from the class name) is
 * what keeps a custom `tableName` resolver honest: `demos/schema-ecommerce`
 * names `Category`'s table `"categories"` (an irregular plural its resolver
 * special-cases) — re-deriving from `Category.name` through the DEFAULT
 * convention would silently produce `"categorys"` instead.
 *
 * A miss (the target isn't part of this batch — a cross-frond target, or a live
 * class the app substituted for one a package hardcoded — e.g.
 * `@fougere/auth-better`'s `AuthSession` always points at its own default
 * `AuthUser`, never at whatever `opts.user` the app actually registered) falls
 * back to deriving the name from the class — correct when that class follows
 * the default convention, wrong if the app ALSO overrides `tableName` for it.
 */
function referenceFor(
  field: AnyField,
  resolve: (name: string) => string,
  tableNameOf?: Map<SchemaLike, string>,
): ColumnReference | undefined {
  const relation = field.role?.relation;
  if (!relation || relation.kind !== 'one') return undefined;
  const target = relation.to() as Partial<SchemaLike> & { name?: string };
  const table = tableNameOf?.get(target as SchemaLike) ?? resolve(registrationName(target.name ?? ''));
  const column = primaryColumnOf(target);
  return relation.onDelete ? { table, column, onDelete: relation.onDelete } : { table, column };
}

function toColumn(
  fieldName: string,
  field: AnyField,
  resolve: (name: string) => string,
  tableNameOf?: Map<SchemaLike, string>,
): ColumnDef {
  // The column type comes from the `shape` axis alone. `anatomy` strips the
  // nullable union so a nullable integer stays an integer instead of falling
  // through to text.
  const { base, nullable } = anatomy(field.shape);
  const create = field.lifecycle?.create;
  const column: ColumnDef = {
    field: fieldName,
    name: toSnakeCase(fieldName),
    shape: base as ColumnShape | undefined,
    nullable,
    primary: field.role?.primary === true,
  };
  if (typeof create === 'object' && create !== null && 'value' in create) {
    column.default = create.value;
  }
  const references = referenceFor(field, resolve, tableNameOf);
  if (references) column.references = references;
  return column;
}

/** How a `ref()` field's target table+column is resolved — see {@link referenceFor}. */
export interface RelationResolve {
  /** Same resolver used for every entity's own table (default or a custom `tableName`). */
  resolve: (name: string) => string;
  /** Live entity class → its already-resolved table name, reused instead of re-derived. */
  tableNameOf?: Map<SchemaLike, string>;
}

/** Describe one entity as a table — the single reader of the axes. */
export function toTable(tableName: string, entity: SchemaLike, relations?: RelationResolve): TableDef {
  const resolve = relations?.resolve ?? toTableName;
  const columns: ColumnDef[] = [];
  for (const [fieldName, field] of Object.entries(entity.getFields())) {
    if (!isStored(field)) continue;
    columns.push(toColumn(fieldName, field, resolve, relations?.tableNameOf));
  }
  const primaries = columns.filter((column) => column.primary).map((column) => column.name);
  return {
    name: tableName,
    columns,
    compositePrimary: primaries.length > 1 ? primaries : [],
  };
}

/**
 * Is this column part of a key? MySQL and SQL Server refuse an unbounded text
 * column in a primary key or an index, so the dialect needs to know.
 */
export function isKeyed(table: TableDef, column: ColumnDef): boolean {
  return column.primary || table.compositePrimary.includes(column.name);
}

// ─── App-wide entity collection — shared by generateSQL and desiredTables ──

/** camelCase → snake_case + plural */
export function toTableName(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`) + 's';
}

export interface EntityEntry {
  name: string;
  entityClass: SchemaLike;
}

export interface FrondLike {
  name: string;
  entities: EntityEntry[];
}

export interface AppLike {
  fronds: FrondLike[];
  /** Auth runtime entities are migrated alongside scanned fronds when present. */
  auth?: { entities: Record<string, SchemaLike> };
}

function collectEntities(app: AppLike): EntityEntry[] {
  const entries: EntityEntry[] = [];
  for (const frond of app.fronds) entries.push(...frond.entities);
  if (app.auth?.entities) {
    for (const [name, entityClass] of Object.entries(app.auth.entities)) entries.push({ name, entityClass });
  }
  return entries;
}

/**
 * Every entity an app hosts, as FK-aware tables — the shared middle step behind
 * `generateSQL` (a from-scratch create pass) and `desiredTables` (the diff's
 * target state). Builds the identity map once (see `referenceFor`'s doc) so a
 * `ref()` target reuses the SAME resolved name as the entity's own table.
 */
export function toTables(app: AppLike, resolve: (name: string) => string): TableDef[] {
  const entries = collectEntities(app);
  const tableNameOf = new Map<SchemaLike, string>(entries.map((entry) => [entry.entityClass, resolve(entry.name)]));
  return entries.map((entry) => toTable(resolve(entry.name), entry.entityClass, { resolve, tableNameOf }));
}

// ─── Ordering — a referenced table before its referrer ─────────────────────

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
