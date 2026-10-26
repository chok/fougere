/** Read across an app's sources — one SQL query over what can be attached. */
import { DuckDBInstance } from '@duckdb/node-api';
import { lowerFirst, type Entity, type SchemaView } from '@fougere/schema';
import { toTable, toTableName, toSnakeCase, codecsOf } from '@fougere/adapter-sql';
import { Sources } from '@fougere/core';


/** An entry of `sources:` as this reader sees it — what its own adapter declared, nothing added. */
export interface SourceEntry {
  type: string;
  path?: string;
  url?: string;
  rows?: string[];
}

export interface ConnectOptions {
  /** The app's sources, exactly as `fougere.config.ts` states them. */
  sources: Record<string, SourceEntry>;
  /** What this scope may read — and therefore what gets attached at all. */
  reads: readonly Entity[];
  /** Same resolver the storage uses, when an app renames tables. */
  tableName?: (name: string) => string;
}

/** A query's answer: the rows, projected onto the shape that was named. */
export interface Reads {
  /** Name the shape the answer takes, then write the query. */
  read<E extends Entity>(shape: E): (sql: TemplateStringsArray, ...refs: unknown[]) => Promise<InstanceType<E>[]>;
  /** The attached sources, by alias — what the scope actually opened. */
  attached: ReadonlyMap<string, string>;
  close(): Promise<void>;
}

/**
 * What DuckDB attaches, read off the entry's own type — the extension it loads and the key that
 * says where. MSSQL, files and memory have no extension, which is why the list is short.
 */
const ATTACHABLE: Record<string, { extension: string; target: (entry: SourceEntry) => string | undefined }> = {
  sqlite: { extension: 'sqlite', target: (entry) => entry.path },
  pg: { extension: 'postgres', target: (entry) => entry.url },
  mysql: { extension: 'mysql', target: (entry) => entry.url },
};

/** DuckDB reserves `main`, `temp` and `system`, and a source may be called any of them. */
const attachedAs = (source: string): string => `source_${source}`;

/** Open a read-only view of the app's sources. */
export async function connectSources(options: ConnectOptions): Promise<Reads> {
  const resolve = options.tableName ?? toTableName;

  // Where each named entity lives; anything unnamed is in the one writable source listing no rows.
  const home = new Map<string, string>();
  let fallback: string | undefined;
  for (const [alias, entry] of Object.entries(options.sources)) {
    if (entry.rows === undefined && !Sources.find(entry.type)?.readOnly) fallback = alias;
    for (const entity of entry.rows ?? []) home.set(lowerFirst(entity), alias);
  }

  // Only what this scope reads is attached — the declaration IS the environment.
  const wanted = new Set<string>();
  const placed = new Map<Entity, { alias: string; table: string }>();
  for (const shape of options.reads) {
    const name = lowerFirst((shape as { name?: string }).name ?? '');
    const alias = home.get(name) ?? fallback;
    if (!alias) throw new Error(`${name} is in no source: none lists it, and none takes the rest. Add it to one in sources:.`);
    wanted.add(alias);
    placed.set(shape, { alias, table: resolve(name) });
  }

  const instance = await DuckDBInstance.create(':memory:');
  const db = await instance.connect();
  const attached = new Map<string, string>();

  for (const alias of wanted) {
    const entry = options.sources[alias];
    if (!entry) throw new Error(`source '${alias}' is read here but missing from sources:.`);

    const attachable = ATTACHABLE[entry.type];
    if (!attachable) {
      throw new Error(
        `source '${alias}' is ${entry.type}, which DuckDB cannot read. It reads `
        + `${Object.keys(ATTACHABLE).join(', ')}: copy the rows into one of those, or read them through their own repository.`,
      );
    }
    const target = attachable.target(entry);
    if (!target) {
      throw new Error(`source '${alias}' has no path or url, so DuckDB cannot open it.`);
    }
    await db.run(`INSTALL ${attachable.extension}; LOAD ${attachable.extension};`);
    await db.run(`ATTACH '${target}' AS ${quote(attachedAs(alias))} (TYPE ${attachable.extension}, READ_ONLY);`);
    attached.set(alias, target);
  }

  return {
    attached,
    close: async () => { db.closeSync(); },
    read<E extends Entity>(shape: E) {
      const schema: SchemaView = shape;
      const fields = schema.getFields();
      const codecs = codecsOf(toTable('x', schema).columns);
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
function qualify(ref: unknown, placed: Map<Entity, { alias: string; table: string }>): string {
  const found = placed.get(ref as Entity);
  if (found) return `${quote(attachedAs(found.alias))}.${quote(found.table)}`;
  const name = (ref as { name?: string } | undefined)?.name;
  if (name) {
    throw new Error(
      `${name} is used in a query but is not in \`reads\`. Add it to \`reads\` in frond.config.ts.`,
    );
  }
  // A plain value interpolated into SQL is refused: this tag substitutes ENTITIES, and
  // accepting a value would be a string-built query with no binding in sight.
  throw new Error(
    'Only an entity can go inside ${…} in a source query. Write values in the query text, or filter the result.',
  );
}

const quote = (identifier: string): string => `"${identifier.replace(/"/g, '""')}"`;

/** The column set, checked ONCE against the shape. */
function refuseMismatch(shape: Entity, names: string[], row: Record<string, unknown>, sql: string): void {
  const missing = names.filter((name) => !(toSnakeCase(name) in row) && !(name in row));
  if (missing.length === 0) return;
  throw new Error(
    `${(shape as { name?: string }).name ?? 'the shape'} expects ${missing.map((m) => `\`${m}\``).join(', ')}, `
    + `and the query returns ${Object.keys(row).map((c) => `\`${c}\``).join(', ')}. Rename the column with \`as\`, `
    + `or remove the field.\n${sql.trim()}`,
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

