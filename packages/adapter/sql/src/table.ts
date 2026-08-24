import { Lifecycle, Role } from '@fougere/schema';
/**
 * Entity → table description, with no SQL in sight.
 *
 * This is the neutral middle term: one projection reads the entity's axes and
 * produces a `TableDef`; a `Dialect` turns that into SQL. Neither half knows the
 * other — the entity never mentions a column type, the dialect never mentions a
 * field. Adding a dialect touches only the second half.
 */
import { Anatomy, FieldGroup, Unique, fieldsOf, registrationKeyOf, schemaOf, type Field, type SchemaView, type SchemaSource } from '@fougere/schema';
import { boundsOf, type ShapeBounds } from './check.js';

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
 * for real; a relation reconstructed from a lone card (`reconstruct()`, no
 * bundle — `packages/schema/src/projections/card.ts:18-22`) has lost it to a
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
  tableNameOf?: Map<SchemaSource, string>,
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
    const key = registrationKeyOf(target.name ?? '');
    if (hosted.elsewhere.has(key)) return undefined;
    if (!hosted.here.has(key)) {
      throw new Error(
        `ref(${target.name ?? '?'}): no source hosts it — it is in neither this batch nor another one. ` +
        `Check the entity is scanned, and that \`sources\` spells its name the same way.`,
      );
    }
  }
  const table = mapped ?? resolve(registrationKeyOf(target.name ?? ''));
  const column = primaryColumnOf(target);
  return relation.onDelete ? { table, column, onDelete: relation.onDelete } : { table, column };
}

function toColumn(
  fieldName: string,
  field: Field,
  resolve: (name: string) => string,
  tableNameOf?: Map<SchemaSource, string>,
  hosted?: HostedNames,
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
  return column;
}

/** How a `ref()` field's target table+column is resolved — see {@link referenceFor}. */
export interface RelationResolve {
  /** Same resolver used for every entity's own table (default or a custom `tableName`). */
  resolve: (name: string) => string;
  /** Live entity class → its already-resolved table name, reused instead of re-derived. */
  tableNameOf?: Map<SchemaSource, string>;
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
 * Pass a bundle through `reconstructSet` first when the FKs matter — it resolves the
 * targets, and its output is the live-class case again.
 */
export function toTable(tableName: string, entity: SchemaSource, relations?: RelationResolve): TableDef {
  const resolve = relations?.resolve ?? toTableName;
  const fields = fieldsOf(entity);
  const columns: ColumnDef[] = [];
  for (const [fieldName, field] of Object.entries(fields)) {
    if (!isStored(field)) continue;
    columns.push(toColumn(fieldName, field, resolve, relations?.tableNameOf, relations?.hosted));
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
  entityClass: SchemaSource;
}

export interface FrondLike {
  name: string;
  entities: EntityEntry[];
}

export interface AppLike {
  fronds: FrondLike[];
  /** Auth runtime entities are migrated alongside scanned fronds when present. */
  auth?: { entities: Record<string, SchemaSource> };
  /**
   * Entities this app hosts in ANOTHER source — named so a miss can be read.
   *
   * Without it every miss looked alike, so a `ref()` fell back to a derived table name
   * and the constraint was emitted against a table that might not exist. Absent means
   * one source, where a miss can only be a mistake.
   */
  elsewhere?: string[];
  /**
   * The DERIVATIONS this app stores — registration names.
   *
   * A derivation makes no table by default: `Post.pick('id','title')` describes an
   * answer, not a place rows live, and one dropped under `entities/` used to get a
   * table of its own — measured on a real app, where a projection of an archived
   * entity created a duplicate in the OTHER database.
   *
   * Naming it in `sources:` is the opt-in, and it changes what the thing is: a stored
   * derivation is a dated COPY, not a projection, and it owes what any copy owes —
   * who fills it, and how old it is.
   */
  materialize?: string[];
}

/**
 * Does this schema come from another one? `Post` answers no, `Post.pick(…)` answers
 * `Post` — a derivation carries its origin, which `sourceNameOf` already reads for two
 * other projections. Recognised by that FORM, never by a brand.
 */
function isDerivation(source: SchemaSource): boolean {
  return schemaOf(source).derivation !== undefined;
}

/**
 * A stored derivation must be able to say HOW OLD it is.
 *
 * It is a copy, and a copy read as if it were live is the silent loss this whole
 * design exists to refuse: rows from yesterday typed exactly like rows from now. The
 * vocabulary already carries the answer — a field with `update: 'now'` records when
 * this row last changed HERE, which for a copy is when it was last pulled. So nothing
 * new is declared; what is new is that forgetting it is refused, at boot, by name.
 *
 * An entity is untouched: it is not a copy of anything, and its rows are the truth.
 */
function refuseUndated(name: string, source: SchemaSource): void {
  const dated = Object.values(fieldsOf(source)).some((field) => Lifecycle.of(field).stampedOnUpdate);
  if (dated) return;
  throw new Error(
    `${name} is stored as a derivation but carries no \`updated()\` field — a copy that ` +
    `cannot say when it was pulled reads exactly like live rows. Add one, or drop it from \`sources\`.`,
  );
}

function collectEntities(app: AppLike): EntityEntry[] {
  const stored = new Set((app.materialize ?? []).map((name) => registrationKeyOf(name)));
  const entries: EntityEntry[] = [];
  for (const frond of app.fronds) {
    for (const entry of frond.entities) {
      if (isDerivation(entry.entityClass)) {
        if (!stored.has(registrationKeyOf(entry.name))) continue;
        refuseUndated(entry.name, entry.entityClass);
      }
      entries.push(entry);
    }
  }
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
  const tableNameOf = new Map<SchemaSource, string>(entries.map((entry) => [entry.entityClass, resolve(entry.name)]));
  const hosted = app.elsewhere
    ? { here: new Set(entries.map((entry) => registrationKeyOf(entry.name))), elsewhere: new Set(app.elsewhere.map(registrationKeyOf)) }
    : undefined;
  return entries.map((entry) => toTable(resolve(entry.name), entry.entityClass, { resolve, tableNameOf, hosted }));
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
