/**
 * The source types this adapter answers, each declared once: its format is what an entry may
 * say — the editor reads it as a type, the boot judges the entry by it — and what opens one.
 *
 * Documented: [sources](https://fougere.dev/docs/infra/sources).
 */
import { Format, type Accepted } from '@fougere/schema';
import { Sources } from '@fougere/core';
import { createSqliteSource } from './sqlite/SqliteSource.js';
import { createD1Source } from './d1/D1Source.js';
import { createKyselySource } from './source/SqlSource.js';
import { dialectFor } from './driver/Driver.js';

const SQLITE = Format.of('source/sqlite')
  .key('type', Format.tokens(['sqlite']))
  .key('path', Format.text)
  .needs('type', 'path')
  .closed();

/** An engine reached over the network: a url, and nothing else to say. */
const server = <Name extends 'pg' | 'mysql' | 'mssql'>(name: Name) => Format.of(`source/${name}`)
  .key('type', Format.tokens([name]))
  .key('url', Format.text)
  .needs('type', 'url')
  .closed();

const PG = server('pg');
const MYSQL = server('mysql');
const MSSQL = server('mssql');

const D1 = Format.of('source/d1')
  .key('type', Format.tokens(['d1']))
  .key('binding', Format.text)
  .needs('type', 'binding')
  .closed();

declare module '@fougere/core' {
  interface FougereSources {
    sqlite: Accepted<typeof SQLITE>;
    pg: Accepted<typeof PG>;
    mysql: Accepted<typeof MYSQL>;
    mssql: Accepted<typeof MSSQL>;
    d1: Accepted<typeof D1>;
  }
}

Sources.register('sqlite', { format: SQLITE, open: (entry) => createSqliteSource({ path: entry.path }) });
for (const [name, format] of [['pg', PG], ['mysql', MYSQL], ['mssql', MSSQL]] as const) {
  Sources.register(name, { format, open: (entry: { url: string }) => createKyselySource(dialectFor(name, entry.url), name) });
}
Sources.register('d1', { format: D1, open: (entry) => createD1Source(entry.binding) });

