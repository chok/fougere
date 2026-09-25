import { createRequire } from 'node:module';
import { join } from 'node:path';
import { MssqlDialect, MysqlDialect, PostgresDialect, type Dialect as KyselyDialect } from 'kysely';
import type { Engine } from '../fields/Engine.js';

/**
 * The packages each engine opens with. The APP installs them, never this package, so a
 * project that opens no SQL installs no driver — and nothing native.
 *
 * Documented: [sources](https://fougere.dev/docs/infra/sources).
 */
export const PACKAGES: Record<Engine, string[]> = {
  sqlite: ['better-sqlite3'],
  pg: ['pg'],
  mysql: ['mysql2'],
  mssql: ['tedious', 'tarn'],
};

/** The Kysely dialect an engine builds from a url, over its packages. SQLite opens a path. */
export type Driver = (url: string, modules: any[]) => KyselyDialect;

export const DRIVERS: Record<Exclude<Engine, 'sqlite'>, Driver> = {
  pg: (url, [pg]) => new PostgresDialect({ pool: new pg.Pool({ connectionString: url }) }),
  mysql: (url, [mysql]) => new MysqlDialect({ pool: mysql.createPool(url) }),
  mssql: (url, [tedious, tarn]) => new MssqlDialect({
    tarn: { ...tarn, options: { min: 0, max: 10 } },
    tedious: { ...tedious, connectionFactory: () => new tedious.Connection(tediousConfig(url)) },
  }),
};

/**
 * The packages of `engine`, resolved from the app — loaded at the moment it opens, not before.
 * What is not installed and what is installed but will not load are two refusals, and each
 * names what to do.
 */
export function modulesOf(engine: Engine, from = process.cwd()): any[] {
  const require = createRequire(join(from, 'package.json'));
  const packages = PACKAGES[engine];
  const missing = packages.filter((name) => !resolves(require, name));
  if (missing.length) {
    throw new Error(
      `The ${engine} engine opens through ${quoted(packages)}, and ${quoted(missing)} is not installed beside the app (${from}).\n`
      + `Install it there: pnpm add ${missing.join(' ')}`,
    );
  }

  return packages.map((name) => {
    try {
      return require(name);
    } catch (error) {
      throw new Error(
        `The ${engine} engine opens through '${name}', which is installed beside the app (${from}) but does not load: ${messageOf(error)}`,
        { cause: error },
      );
    }
  });
}

function resolves(require: NodeJS.Require, name: string): boolean {
  try {
    require.resolve(name);

    return true;
  } catch {
    return false;
  }
}

function quoted(names: string[]): string {
  return names.map((name) => `'${name}'`).join(' and ');
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message.split('\n')[0] : String(error);
}

/** The dialect `url` names, over the driver the app installed beside it. */
export function dialectFor(engine: Exclude<Engine, 'sqlite'>, url: string, from = process.cwd()): KyselyDialect {
  return DRIVERS[engine](url, modulesOf(engine, from));
}

/** `mssql://user:password@host:1433/database` — tedious takes an object and reads no url. */
export function tediousConfig(url: string) {
  const parsed = new URL(url);
  const port = parsed.port ? Number(parsed.port) : 1433;
  const database = decodeURIComponent(parsed.pathname.slice(1)) || undefined;
  const authentication = {
    type: 'default',
    options: { userName: decodeURIComponent(parsed.username), password: decodeURIComponent(parsed.password) },
  };

  return { server: parsed.hostname, authentication, options: { port, database, trustServerCertificate: true } };
}
