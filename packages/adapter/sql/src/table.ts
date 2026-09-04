import { Lifecycle, Role } from '@fougere/schema';
/** Entity → table description, with no SQL in sight. */
import { Shapes, fieldsOf, lowerFirst, schemaOf, type Field, type SchemaView, type SchemaOrCard } from '@fougere/schema';
import { boundsOf, type ShapeBounds } from './check.js';
import { sqlEntries, type SqlField } from './fields.js';

/** The shape keywords a dialect needs to choose a column type. */
export interface ColumnShape {
  type?: string;
  format?: string;
  maxLength?: number;
}

/** One column, described by the axes — plus, at most, what the entity stated for sql. */
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
  /** A {@link Unique} of one — realized as a column constraint the database enforces. */
  unique?: boolean;
  /** `role.index` — realized as a separate `CREATE INDEX`, never a constraint. */
  index?: boolean;
  /**
   * What the shape bounds beyond its type — `oneOf`, `min`, `max`. Realized as a
   * `CHECK`, so the rule holds on every write and not only at the façade.
   */
  bounds?: ShapeBounds;
  /** The FK target, from `role.relation` when it's a `ref()` (kind `'one'`). */
  references?: ColumnReference;
  /**
   * What the entity stated for THIS adapter — never an axis. It says how the column is
   * realized here; drop it and the column is still describable.
   */
  stated?: SqlField;
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
  /** Column groups unique together, from `entity(fields, { unique: */
  uniqueGroups: string[][];
}

/** camelCase → snake_case */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * A `many` relation owns no column — the join lives on the other side. Every
 * other field becomes exactly one column.
 */
function isStored(field: Field): boolean {
  return !Role.of(field).isCollection;
}

/** The target's primary key column. */
function primaryColumnOf(target: Partial<SchemaView>): string {
  if (typeof target.getFields !== 'function') return 'id';
  for (const [name, field] of Object.entries(target.getFields())) {
    if (Role.of(field).isPrimary) return toSnakeCase(name);
  }
  return 'id'; // declared no primary() field — defensive, shouldn't happen
}

/** The FK target for a `ref()` field: */
function referenceFor(
  field: Field,
  resolve: (name: string) => string,
  tableNameOf?: Map<SchemaOrCard, string>,
  hosted?: HostedNames,
): ColumnReference | undefined {
  const relation = Role.of(field).relation;
  if (!relation || relation.kind !== 'one') return undefined;
  const target = relation.to() as Partial<SchemaView> & { name?: string };
  const mapped = tableNameOf?.get(target as SchemaView);
  if (mapped === undefined && hosted !== undefined) {
    // Three answers, and only the first two are ordinary. Two databases share no
    // constraint, so a target that lives in another source gets a column and no
    // foreign key — the relation survives, the pretence does not. A target no source
    // hosts is a mistake, and staying silent would turn a bad registration into what
    // reads exactly like a source boundary.
    //
    // Decided on the NAME and never on object identity: a target reached through two
    // specifiers (`./Subscription.js` from a sibling entity, `Subscription.ts` from
    // the scan) is TWO class objects for one entity, so the identity map misses on an
    // entity that is right there. Measured on a real app, where this threw on
    // `ref(Subscription)` while the table was in the very batch being built. Everything
    // else that resolves a relation target already resolves it by name, for the same
    // reason — a target rebuilt from a card is a `{ name }` stand-in.
    const key = lowerFirst(target.name ?? '');
    if (hosted.elsewhere.has(key)) return undefined;
    if (!hosted.here.has(key)) {
      throw new Error(
        `ref(${target.name ?? '?'}): no source hosts it — it is in neither this batch nor another one. ` +
        `Check the entity is scanned, and that \`sources\` spells its name the same way.`,
      );
    }
  }
  const table = mapped ?? resolve(lowerFirst(target.name ?? ''));
  const column = primaryColumnOf(target);
  return relation.onDelete ? { table, column, onDelete: relation.onDelete } : { table, column };
}

function toColumn(
  fieldName: string,
  field: Field,
  resolve: (name: string) => string,
  tableNameOf?: Map<SchemaOrCard, string>,
  hosted?: HostedNames,
  stated?: SqlField,
): ColumnDef {
  // The column type comes from the `shape` axis alone. `anatomy` strips the
  // nullable union so a nullable integer stays an integer instead of falling
  // through to text.
  const { base, nullable } = Shapes.of(field.shape);
  const lifecycle = Lifecycle.of(field);
  const column: ColumnDef = {
    field: fieldName,
    name: toSnakeCase(fieldName),
    shape: base as ColumnShape | undefined,
    nullable,
    primary: Role.of(field).isPrimary,
  };
  const bounds = boundsOf(base as Record<string, unknown> | undefined);
  if (bounds) column.bounds = bounds;
  const literal = lifecycle.literal;
  if (literal) column.default = literal.value;
  // A primary key is already unique and already indexed — saying it twice would emit a
  // redundant constraint on every engine. So would indexing what `unique` constrains.
  // Only a constraint of ONE becomes a column constraint; a group of several is a table
  // constraint, emitted once from `uniqueGroups` rather than once per member column.
  if (Role.of(field).isUnique && !column.primary) column.unique = true;
  if (Role.of(field).isIndexed && !column.primary && !column.unique) column.index = true;
  const references = referenceFor(field, resolve, tableNameOf, hosted);
  if (references) column.references = references;
  if (stated) column.stated = stated;
  return column;
}

/** How a `ref()` field's target table+column is resolved — see {@link referenceFor}. */
export interface RelationResolve {
  /** Same resolver used for every entity's own table (default or a custom `tableName`). */
  resolve: (name: string) => string;
  /** Live entity class → its already-resolved table name, reused instead of re-derived. */
  tableNameOf?: Map<SchemaOrCard, string>;
  /** Which entities this batch holds and which live in another source — decided by NAME. */
  hosted?: HostedNames;
}

/** The two name sets a cross-source batch is read against — see {@link referenceFor}. */
export interface HostedNames {
  /** Registration names in THIS batch. */
  here: ReadonlySet<string>;
  /** Registration names the app hosts in another source — see {@link AppLike.elsewhere}. */
  elsewhere: ReadonlySet<string>;
}

/** Describe one entity as a table — the single reader of the axes. */
export function toTable(tableName: string, entity: SchemaOrCard, relations?: RelationResolve): TableDef {
  const resolve = relations?.resolve ?? toTableName;
  const fields = fieldsOf(entity);
  // Read off the entity, since that is where it is declared and addressed by field key.
  const schema = schemaOf(entity);
  const configuration = schema.getAdapters().sql;
  // Judged HERE and not at `entity()`: this runs at boot, after every import, so the
  // format is always loaded. A judge registered with `schema` would depend on which
  // module was imported first.
  sqlEntries.assert(configuration, `${schema.name}.adapters.sql`);
  const columns: ColumnDef[] = [];
  for (const [fieldName, field] of Object.entries(fields)) {
    if (!isStored(field)) continue;
    columns.push(toColumn(fieldName, field, resolve, relations?.tableNameOf, relations?.hosted, configuration?.[fieldName]));
  }
  const primaries = columns.filter((column) => column.primary).map((column) => column.name);
  const stored = new Set(columns.map((column) => column.name));
  // Declared in field names, realized in column names — and a group naming a field the
  // storage does not keep is not enforceable, so it is dropped rather than emitted against
  // a column that will not exist.
  const uniqueGroups = (schema.getUnique() ?? [])
    .map((group) => group.map(toSnakeCase))
    .filter((members) => members.every((column) => stored.has(column)));

  return {
    name: tableName,
    columns,
    compositePrimary: primaries.length > 1 ? primaries : [],
    uniqueGroups,
  };
}

/** Is this column part of a key? MySQL and SQL Server refuse an unbounded text column in a primary k… */
export function isKeyed(table: TableDef, column: ColumnDef): boolean {
  return column.primary
    || column.unique === true
    || column.index === true
    || table.compositePrimary.includes(column.name);
}

// ─── App-wide entity collection — shared by generateSQL and desiredTables ──

/** camelCase → snake_case + plural */
export function toTableName(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`) + 's';
}

export interface EntityEntry {
  name: string;
  /** A live class in-process, a card from a frond whose class never crossed. */
  entityClass: SchemaOrCard;
}

export interface FrondLike {
  name: string;
  entities: EntityEntry[];
}

export interface AppLike {
  fronds: FrondLike[];
  /** Auth runtime entities are migrated alongside scanned fronds when present. */
  auth?: { entities: Record<string, SchemaOrCard> };
  /** Entities this app hosts in ANOTHER source — named so a miss can be read. */
  elsewhere?: string[];
}

/** A schema says whether it holds rows; this adapter decides what to emit for it. */
function verdictOn(entry: EntityEntry): 'table' | 'answer' {
  const schema = schemaOf(entry.entityClass);

  return !schema.derivation || schema.anchored ? 'table' : 'answer';
}

/** Every entity this app hosts, once each. */
function collectEntities(app: AppLike): EntityEntry[] {
  const entries: EntityEntry[] = [];
  const seen = new Set<string>();
  const hold = (entry: EntityEntry) => {
    if (seen.has(lowerFirst(entry.name))) return;
    seen.add(lowerFirst(entry.name));
    entries.push(entry);
  };

  for (const frond of app.fronds) {
    for (const entry of frond.entities) {
      if (verdictOn(entry) === 'table') hold(entry);
    }
  }
  if (app.auth?.entities) {
    for (const [name, entityClass] of Object.entries(app.auth.entities)) hold({ name, entityClass });
  }

  return entries;
}

/** Every entity an app hosts, as FK-aware tables — the shared middle step behind `generateSQL` (a fr… */
export function toTables(app: AppLike, resolve: (name: string) => string): TableDef[] {
  const entries = collectEntities(app);
  const tableNameOf = new Map<SchemaOrCard, string>(entries.map((entry) => [entry.entityClass, resolve(entry.name)]));
  const hosted = app.elsewhere
    ? { here: new Set(entries.map((entry) => lowerFirst(entry.name))), elsewhere: new Set(app.elsewhere.map(lowerFirst)) }
    : undefined;
  return entries.map((entry) => toTable(resolve(entry.name), entry.entityClass, { resolve, tableNameOf, hosted }));
}

// ─── Ordering — a referenced table before its referrer ─────────────────────
