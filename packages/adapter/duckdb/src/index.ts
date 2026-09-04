/** Read across an app's sources — one SQL query over what can be attached. */
import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import { lowerFirst, fieldsOf, type SchemaOrCard } from '@fougere/schema';
import { toTable, toTableName, toSnakeCase, codecsOf } from '@fougere/adapter-sql';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeClass = abstract new (...args: any[]) => any;

/** The engines DuckDB can attach — and the reason the list is short. */
export type Attachable = 'sqlite' | 'postgres' | 'mysql';

export interface SourceDeclaration {
  /** A file, for sqlite. */
  path?: string;
  /** A connection string, for an engine reached over the network. */
  attach?: string;
  /** Defaults to sqlite, the engine `db:` resolves from a name. */
  type?: Attachable;
  /** Registration names of the entities whose rows live here. */
  entities: string[];
}

export interface ConnectOptions {
  /** The default source — where an entity no declaration names lives. */
  db: { path?: string; attach?: string; type?: Attachable };
  /** The other places, exactly as `fougere.config.ts` states them. */
  sources?: Record<string, SourceDeclaration>;
  /** What this scope may read — and therefore what gets attached at all. */
  reads: readonly ShapeClass[];
  /** Same resolver the storage uses, when an app renames tables. */
  tableName?: (name: string) => string;
}

/** A query's answer: the rows, projected onto the shape that was named. */
export interface Reads {
  /** Name the shape the answer takes, then write the query. */
  read<E extends ShapeClass>(shape: E): (sql: TemplateStringsArray, ...refs: unknown[]) => Promise<InstanceType<E>[]>;
  /** The attached sources, by alias — what the scope actually opened. */
  attached: ReadonlyMap<string, string>;
  close(): Promise<void>;
}

const EXTENSION: Record<Attachable, string> = {
  sqlite: 'sqlite',
  postgres: 'postgres',
  mysql: 'mysql',
};

const TYPE_CLAUSE: Record<Attachable, string> = {
  sqlite: 'sqlite',
  postgres: 'postgres',
  mysql: 'mysql',
};

/** The default source's alias — the same word `fougere.config.ts` uses for it. */
const DEFAULT_ALIAS = 'db';

/** 'Book' and 'book' name the same rows — the spelling `sources:` accepts either way. */

function targetOf(declaration: { path?: string; attach?: string }, alias: string): string {
  const target = declaration.attach ?? declaration.path;
  if (!target) {
    throw new Error(
      `source '${alias}': neither \`path\` nor \`attach\` — DuckDB is told what to open, ` +
      `and an in-memory database of its own would hold none of your rows.`,
    );
  }
  return target;
}

/** Open a read-only view of the app's sources. */
export async function connectSources(options: ConnectOptions): Promise<Reads> {
  const resolve = options.tableName ?? toTableName;

  // Where each named entity lives; anything unnamed is in the default source.
  const home = new Map<string, string>();
  for (const [alias, declaration] of Object.entries(options.sources ?? {})) {
    for (const entity of declaration.entities) home.set(lowerFirst(entity), alias);
  }

  // Only what this scope reads is attached — the declaration IS the environment.
  const wanted = new Set<string>();
  const placed = new Map<ShapeClass, { alias: string; table: string }>();
  for (const shape of options.reads) {
    const name = lowerFirst((shape as { name?: string }).name ?? '');
    const alias = home.get(name) ?? DEFAULT_ALIAS;
    wanted.add(alias);
    placed.set(shape, { alias, table: resolve(name) });
  }

  const instance = await DuckDBInstance.create(':memory:');
  const db = await instance.connect();
  const attached = new Map<string, string>();

  for (const alias of wanted) {
    const declaration = alias === DEFAULT_ALIAS
      ? { ...options.db, entities: [] }
      : options.sources?.[alias];
    if (!declaration) throw new Error(`source '${alias}' is read but never declared.`);

    const type = declaration.type ?? 'sqlite';
    if (!(type in EXTENSION)) {
      throw new Error(
        `source '${alias}' is a ${type} database, which DuckDB cannot attach — there is no ` +
        `such extension. Read it by key through its own storage, or mirror it into one of ` +
        `${Object.keys(EXTENSION).join(', ')}.`,
      );
    }
    await db.run(`INSTALL ${EXTENSION[type]}; LOAD ${EXTENSION[type]};`);
    await db.run(`ATTACH '${targetOf(declaration, alias)}' AS ${quote(alias)} (TYPE ${TYPE_CLAUSE[type]}, READ_ONLY);`);
    attached.set(alias, targetOf(declaration, alias));
  }

  return {
    attached,
    close: async () => { db.closeSync(); },
    read<E extends ShapeClass>(shape: E) {
      const fields = fieldsOf(shape as unknown as SchemaOrCard);
      const codecs = codecsOf(toTable('x', shape as unknown as SchemaOrCard).columns);
      const names = Object.keys(fields);

      return async (parts: TemplateStringsArray, ...refs: unknown[]) => {
        const sql = parts.reduce((out, part, i) => out + part + (i < refs.length ? qualify(refs[i], placed) : ''), '');
        const rows = (await db.runAndReadAll(sql)).getRowObjects();
        if (rows.length > 0) refuseMismatch(shape, names, rows[0] as Record<string, unknown>, sql);
        return rows.map((row) => project(names, codecs, row as Record<string, unknown>)) as InstanceType<E>[];
      };
    },
  };
}

/** `${Book}` becomes `archive.books` — the alias AND the table, from one declaration. */
function qualify(ref: unknown, placed: Map<ShapeClass, { alias: string; table: string }>): string {
  const found = placed.get(ref as ShapeClass);
  if (found) return `${quote(found.alias)}.${quote(found.table)}`;
  const name = (ref as { name?: string } | undefined)?.name;
  if (name) {
    throw new Error(
      `${name} is named in a query but not in \`reads\` — its source is not attached, so its ` +
      `table does not exist in this connection. Add it to \`reads\`, or stop naming it.`,
    );
  }
  // A plain value interpolated into SQL is refused: this tag substitutes ENTITIES, and
  // accepting a value would be a string-built query with no binding in sight.
  throw new Error(
    `only an entity may be interpolated into a source query — pass a value through the ` +
    `query text you write, or filter the result.`,
  );
}

const quote = (identifier: string): string => `"${identifier.replace(/"/g, '""')}"`;

/** The column set, checked ONCE against the shape. */
function refuseMismatch(shape: ShapeClass, names: string[], row: Record<string, unknown>, sql: string): void {
  const missing = names.filter((name) => !(toSnakeCase(name) in row) && !(name in row));
  if (missing.length === 0) return;
  throw new Error(
    `${(shape as { name?: string }).name ?? 'the shape'} declares ${missing.map((m) => `\`${m}\``).join(', ')}, ` +
    `and the query answers ${Object.keys(row).map((c) => `\`${c}\``).join(', ')} — name the column with ` +
    `\`as\`, or drop the field.\n${sql.trim()}`,
  );
}

/** Keep what the shape declares, converted — a column it does not name never leaves. */
function project(
  names: string[],
  codecs: Map<string, { read(value: unknown): unknown }>,
  row: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const name of names) {
    const column = toSnakeCase(name);
    const raw = column in row ? row[column] : row[name];
    out[name] = codecs.get(name)?.read(raw) ?? raw;
  }
  return out;
}

export type { DuckDBConnection };
