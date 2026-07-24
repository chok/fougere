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

function toColumn(fieldName: string, field: AnyField): ColumnDef {
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
  return column;
}

/** Describe one entity as a table — the single reader of the axes. */
export function toTable(tableName: string, entity: SchemaLike): TableDef {
  const columns: ColumnDef[] = [];
  for (const [fieldName, field] of Object.entries(entity.getFields())) {
    if (!isStored(field)) continue;
    columns.push(toColumn(fieldName, field));
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
