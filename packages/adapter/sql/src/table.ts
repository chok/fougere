import { Lifecycle, Role } from '@fougere/schema';
/**
 * Entity → table description, with no SQL in sight.
 *
 * This is the neutral middle term: one projection reads the entity's axes and
 * produces a `TableDef`; a `Dialect` turns that into SQL. Neither half knows the
 * other — the dialect never mentions a field. Adding a dialect touches only the
 * second half.
 *
 * `ColumnDef.stated` is the one member the axes did not produce. It names one engine's
 * column type, so dropping it leaves every column describable.
 */
import { Anatomy, FieldGroup, Unique, fieldsOf, lowerFirst, schemaOf, type Field, type SchemaView, type SchemaOrCard } from '@fougere/schema';
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
  /**
   * Column groups unique together, from `entity(fields, { unique: [...] })`.
   * A single-field group is left to the column's own `unique` — this is the
   * table-level form, for facts no column can hold alone.
   */
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

/**
 * The target's primary key column. A live thunk (an in-process entity) answers
 * for real; a relation reconstructed from a lone `Card` (without a `Bundle`) has lost it to a
 * name stand-in with no `getFields` — the convention there is to assume `id`.
 */
function primaryColumnOf(target: Partial<SchemaView>): string {
  if (typeof target.getFields !== 'function') return 'id';
  for (const [name, field] of Object.entries(target.getFields())) {
    if (Role.of(field).isPrimary) return toSnakeCase(name);
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
  const { base, nullable } = Anatomy.of(field.shape);
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
  const soleUnique = FieldGroup.on(field, Unique).some((group) => group.members.length <= 1);
  if (soleUnique && !column.primary) column.unique = true;
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

/**
 * Describe one entity as a table — the single reader of the axes.
 *
 * Takes the entity as a live class or as a card. Read ONCE into `fields`: `fieldsOf`
 * reconstructs a descriptor on each call, so re-reading per loop would rebuild the schema
 * as many times as this function iterates.
 *
 * A lone card has no live relation targets, so a `ref()` falls back to the conventions
 * `referenceFor`/`primaryColumnOf` already document (name-derived table, `id` as the key).
 * Pass a descriptor through `Bundle.toSchemas` first when the FKs matter — it resolves the
 * targets, and its output is the live-class case again.
 */
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
  // Read off the fields, not off `getUnique()`: a card has no entity-level declaration to
  // offer, and the members carry the same fact either way. One reader for both forms.
  //
  // Declared in field names, realized in column names — and a group that names a field the
  // storage does not keep is not enforceable, so it is dropped here rather than emitted
  // against a column that will not exist.
  const groups = new Map<string, string[]>();
  for (const [fieldName, field] of Object.entries(fields)) {
    for (const group of FieldGroup.on(field, Unique)) {
      const members = group.resolvedOn(fieldName).members.map(toSnakeCase);
      if (members.length > 1 && members.every((column) => stored.has(column))) {
        groups.set(members.join(' '), members);
      }
    }
  }
  const uniqueGroups = [...groups.values()];

  return {
    name: tableName,
    columns,
    compositePrimary: primaries.length > 1 ? primaries : [],
    uniqueGroups,
  };
}

/**
 * Is this column part of a key? MySQL and SQL Server refuse an unbounded text
 * column in a primary key or an index, so the dialect needs to know.
 *
 * `unique` and `index` count, and until they could be declared nothing did but the
 * primary key — the comment above already said "or an index" while the code answered
 * for the key alone, because no vocabulary word produced one to answer for.
 */
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
  /**
   * Entities this app hosts in ANOTHER source — named so a miss can be read.
   *
   * Without it every miss looked alike, so a `ref()` fell back to a derived table name
   * and the constraint was emitted against a table that might not exist. Absent means
   * one source, where a miss can only be a mistake.
   */
  elsewhere?: string[];
}

/**
 * A schema says whether it holds rows; this adapter decides what to emit for it.
 *
 * A root always did. A derivation describes ANOTHER's rows — `Post.pick('id','title')` is
 * a shape, and one dropped under `entities/` used to get a table of its own: measured on a
 * real app, where a projection of an archived entity created a duplicate in the OTHER
 * database. `.anchor()` is what says otherwise, and it is the entity's own word, never a
 * key of the app's config: a frond stays mountable without its host knowing.
 */
function verdictOn(entry: EntityEntry): 'table' | 'answer' {
  const schema = schemaOf(entry.entityClass);

  return !schema.derivation || schema.anchored ? 'table' : 'answer';
}

/**
 * Every entity this app hosts, once each. The same class reaches here under one
 * registration name from two lists — a frond's `entities/` and the auth runtime's map —
 * and two entries for one name are two CREATE TABLE for one table.
 */
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

/**
 * Every entity an app hosts, as FK-aware tables — the shared middle step behind
 * `generateSQL` (a from-scratch create pass) and `desiredTables` (the diff's
 * target state). Builds the identity map once (see `referenceFor`'s doc) so a
 * `ref()` target reuses the SAME resolved name as the entity's own table.
 */
export function toTables(app: AppLike, resolve: (name: string) => string): TableDef[] {
  const entries = collectEntities(app);
  const tableNameOf = new Map<SchemaOrCard, string>(entries.map((entry) => [entry.entityClass, resolve(entry.name)]));
  const hosted = app.elsewhere
    ? { here: new Set(entries.map((entry) => lowerFirst(entry.name))), elsewhere: new Set(app.elsewhere.map(lowerFirst)) }
    : undefined;
  return entries.map((entry) => toTable(resolve(entry.name), entry.entityClass, { resolve, tableNameOf, hosted }));
}

// ─── Ordering — a referenced table before its referrer ─────────────────────
