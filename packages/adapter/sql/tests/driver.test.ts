/**
 * `{ type: 'pg', url }` names an engine and the app installs its driver. No server is opened
 * here: what is pinned is which dialect the name builds, and what a missing driver answers.
 */
import { describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MssqlDialect, MysqlDialect, PostgresDialect } from 'kysely';
import { Sources } from '@fougere/core';
import { dialectFor, tediousConfig } from '../src/driver/Driver.js';
import '../src/SqlSourceTypes.js';
import { createSqliteSource } from '../src/sqlite/SqliteSource.js';

/** An app directory holding fake drivers, so the resolution is the one an installed app gets. */
function appWith(drivers: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'fougere-driver-'));
  for (const [name, source] of Object.entries(drivers)) {
    mkdirSync(join(root, 'node_modules', name), { recursive: true });
    writeFileSync(join(root, 'node_modules', name, 'index.js'), source);
  }
  writeFileSync(join(root, 'package.json'), '{}');

  return root;
}

const pool = 'module.exports = { Pool: class { constructor(options) { this.options = options; } }, createPool: (url) => ({ url }) };';

describe('an engine named in the config', () => {
  it('builds the Kysely dialect of its engine over the driver the app installed', () => {
    const app = appWith({ pg: pool, mysql2: pool, tedious: 'module.exports = { Connection: class {} };', tarn: 'module.exports = { Pool: class {} };' });

    expect(dialectFor('pg', 'postgres://localhost/app', app)).toBeInstanceOf(PostgresDialect);
    expect(dialectFor('mysql', 'mysql://localhost/app', app)).toBeInstanceOf(MysqlDialect);
    expect(dialectFor('mssql', 'mssql://sa:secret@localhost/app', app)).toBeInstanceOf(MssqlDialect);
  });

  it('names the package to install when the app has none', () => {
    const app = appWith({});

    expect(() => dialectFor('pg', 'postgres://localhost/app', app)).toThrow(/pnpm add pg/);
    expect(() => dialectFor('mssql', 'mssql://localhost/app', app)).toThrow(/pnpm add tedious tarn/);
  });

  it('names only what is missing, and tells a driver that is there but does not load apart', () => {
    const halfway = appWith({ tedious: 'module.exports = {};' });
    const broken = appWith({ pg: 'throw new Error("no libpq");' });

    expect(() => dialectFor('mssql', 'mssql://localhost/app', halfway)).toThrow(/'tarn' is not installed[\s\S]*pnpm add tarn$/);
    expect(() => dialectFor('pg', 'postgres://localhost/app', broken)).toThrow(/'pg', which is installed .* but does not load: no libpq/);
  });

  it('says which file SQLite could not open', () => {
    const directory = mkdtempSync(join(tmpdir(), 'fougere-sqlite-'));

    expect(() => createSqliteSource({ path: directory })).toThrow(`SQLite could not open '${directory}'`);
  });

  it('reads a SQL Server url into the object tedious takes', () => {
    expect(tediousConfig('mssql://sa:p%40ss@db.local:1444/shop')).toEqual({
      server: 'db.local',
      authentication: { type: 'default', options: { userName: 'sa', password: 'p@ss' } },
      options: { port: 1444, database: 'shop', trustServerCertificate: true },
    });
  });

  it('refuses a type it does not answer, a server with no url, and a key its format does not hold', () => {
    expect(() => Sources.open({ type: 'oracle' }, 'sources.main')).toThrow(/Unknown source type 'oracle'.*sqlite, pg, mysql, mssql, d1/);
    expect(() => Sources.open({ type: 'pg' }, 'sources.main')).toThrow(/sources\.main.*url/);
    expect(() => Sources.open({ pathh: 'app.db' } as never, 'sources.main')).toThrow(/pathh/);
  });

  it('opens an entry naming no type as the conventional one, a SQLite file', () => {
    const source = Sources.open({ path: ':memory:' } as never, 'sources.main');

    expect(source.name).toBe(':memory:');
  });
});
