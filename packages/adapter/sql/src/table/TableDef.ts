import { Lifecycle, Role, UUID_GENERATORS } from '@fougere/schema';
import { SchemaError, Shapes, dotted, lowerFirst, pluralOf, type Field, type SchemaView } from '@fougere/schema';
import { boundsOf } from '../check.js';
import { type SqlField } from '../fields/SqlField.js';
import { sqlEntries } from '../fields/SqlFields.js';
import type { ColumnDef } from './ColumnDef.js';
import type { ColumnReference } from './ColumnReference.js';
import type { RelationResolve } from './RelationResolve.js';
import type { HostedNames } from './HostedNames.js';
import type { EntityEntry } from './EntityEntry.js';
import type { SourceView } from '@fougere/core';

export interface TableDef {
  name: string;
  columns: ColumnDef[];
  /** PK column names when the key is composite — empty for a simple key. */
  compositePrimary: string[];
  /** Column groups unique together, from `entity(fields, { unique: [...] })`. */
  uniqueGroups: string[][];
  /** Column groups indexed together, from `entity(fields, { index: [...] })`. */
  indexGroups: string[][];
}

/** camelCase → snake_case */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function isStored(field: Field): boolean {
  return !Role.of(field).isCollection();
}

function primaryColumnOf(target: Partial<SchemaView>): string {
  if (typeof target.getFields !== 'function') return 'id';
  for (const [name, field] of Object.entries(target.getFields())) {
    if (Role.of(field).isPrimary()) return toSnakeCase(name);
  }

  return 'id'; // declared no primary() field — defensive, shouldn't happen
}

function referenceFor(
  field: Field,
  resolve: (name: string) => string,
  tableNameOf?: Map<SchemaView, string>,
  hosted?: HostedNames,
): ColumnReference | undefined {
  const role = Role.of(field);
  if (!role.isReference()) return undefined;
  const target = role.target as Partial<SchemaView> & { name?: string };
  const mapped = tableNameOf?.get(target as SchemaView);
  if (mapped === undefined && hosted !== undefined) {
    const key = lowerFirst(target.name ?? '');
    if (hosted.elsewhere.has(key)) return undefined;
    if (!hosted.here.has(key)) {
      throw new Error(
        `ref(${target.name ?? '?'}): no source holds ${target.name ?? 'this entity'}. `
        + 'Check that the entity exists and that `sources:` spells its name the same way.',
      );
    }
  }
  const table = mapped ?? resolve(lowerFirst(target.name ?? ''));
  const column = primaryColumnOf(target);

  return role.onDelete ? { table, column, onDelete: role.onDelete } : { table, column };
}

function holdsUuids(field: Field, tableNameOf?: Map<SchemaView, string>): boolean {
  const generator = Lifecycle.of(field).generator();
  if (generator !== undefined) return UUID_GENERATORS.has(generator);

  const role = Role.of(field);
  if (!role.isReference() || !tableNameOf) return false;
  const name = (role.target as { name?: string } | undefined)?.name;
  const target = [...tableNameOf.keys()].find((schema) => schema.name === name);
  const key = target && Object.values(target.getFields()).find((one) => Role.of(one).isPrimary());

  return key !== undefined && holdsUuids(key);
}

function toColumn(
  fieldName: string,
  field: Field,
  resolve: (name: string) => string,
  tableNameOf?: Map<SchemaView, string>,
  hosted?: HostedNames,
  stated?: SqlField,
): ColumnDef {
  const { base, nullable } = Shapes.of(field.shape);
  const lifecycle = Lifecycle.of(field);
  const column: ColumnDef = {
    field: fieldName,
    name: toSnakeCase(fieldName),
    type: Shapes.typeOf(field.shape),
    nullable,
    primary: Role.of(field).isPrimary(),
  };
  const bounds = boundsOf(base as Record<string, unknown> | undefined);
  if (bounds) column.bounds = bounds;
  const literal = lifecycle.literal;
  if (literal) column.default = literal.value;
  if (Role.of(field).isUnique() && !column.primary) column.unique = true;
  if (Role.of(field).isIndexed() && !column.primary && !column.unique) column.index = true;
  if (holdsUuids(field, tableNameOf)) column.uuid = true;
  const references = referenceFor(field, resolve, tableNameOf, hosted);
  if (references) column.references = references;
  if (stated) column.stated = stated;

  return column;
}

/** Describe one entity as a table — the single reader of the axes. */
export function toTable(tableName: string, schema: SchemaView, relations?: RelationResolve): TableDef {
  const resolve = relations?.resolve ?? toTableName;
  const fields = schema.getFields();
  const configuration = schema.getAdapters().sql;
  const refusal = configuration === undefined
    ? undefined
    : sqlEntries.refusalOf(configuration, [`${schema.name}.adapters.sql`]);
  if (refusal) throw new SchemaError(`${dotted(refusal.path)}: ${refusal.message}`);
  const columns: ColumnDef[] = [];
  for (const [fieldName, field] of Object.entries(fields)) {
    if (!isStored(field)) continue;
    columns.push(toColumn(fieldName, field, resolve, relations?.tableNameOf, relations?.hosted, configuration?.[fieldName]));
  }
  const primaries = columns.filter((column) => column.primary).map((column) => column.name);
  const stored = new Set(columns.map((column) => column.name));
  const realized = (groups: readonly (readonly string[])[]) => groups
    .map((group) => group.map(toSnakeCase))
    .filter((members) => members.every((column) => stored.has(column)));

  return {
    name: tableName,
    columns,
    compositePrimary: primaries.length > 1 ? primaries : [],
    uniqueGroups: realized(schema.getUnique()),
    indexGroups: realized(schema.getIndex()),
  };
}

/** Whether this column is part of a key. */
export function isKeyed(table: TableDef, column: ColumnDef): boolean {
  return column.primary
    || column.unique === true
    || column.index === true
    || table.compositePrimary.includes(column.name)
    || table.indexGroups.some((group) => group.includes(column.name))
    || table.uniqueGroups.some((group) => group.includes(column.name));
}


/** `orderItem` → `order_items`: the plural, then snake_case. */
export function toTableName(name: string): string {
  return toSnakeCase(pluralOf(lowerFirst(name)));
}

function verdictOn(entry: EntityEntry): 'table' | 'answer' {
  const { entityClass } = entry;

  return !entityClass.derivation || entityClass.anchored ? 'table' : 'answer';
}

function collectEntities(view: SourceView): EntityEntry[] {
  const entries: EntityEntry[] = [];
  const seen = new Set<string>();
  const hold = (entry: EntityEntry) => {
    if (seen.has(lowerFirst(entry.name))) return;
    seen.add(lowerFirst(entry.name));
    entries.push(entry);
  };

  for (const [name, entityClass] of view.entities) {
    const entry = { name, entityClass };
    if (verdictOn(entry) === 'table') hold(entry);
  }

  return entries;
}

/** Every entity an app hosts, as tables aware of their foreign keys. */
export function toTables(view: SourceView, resolve: (name: string) => string): TableDef[] {
  const entries = collectEntities(view);
  const tableNameOf = new Map<SchemaView, string>(entries.map((entry) => [entry.entityClass, resolve(entry.name)]));
  const hosted = view.inOtherSources
    ? { here: new Set(entries.map((entry) => lowerFirst(entry.name))), elsewhere: new Set(view.inOtherSources.map(lowerFirst)) }
    : undefined;

  return entries.map((entry) => toTable(resolve(entry.name), entry.entityClass, { resolve, tableNameOf, hosted }));
}

