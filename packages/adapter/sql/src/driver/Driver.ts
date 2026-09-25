import { createRequire } from 'node:module';
import { join } from 'node:path';
import { MssqlDialect, MysqlDialect, PostgresDialect, type Dialect as KyselyDialect } from 'kysely';
import type { Engine } from '../fields/Engine.js';

/**
 * What opens an engine from a url: the packages the APP installs, and the Kysely dialect built
 * over them. SQLite is not here — its driver is this package's own.
 *
 * Documented: [sources](https://fougere.dev/docs/infra/sources).
 */
export interface Driver {
  packages: string[];
  dialect(url: string, modules: any[]): KyselyDialect;
}

export const DRIVERS: Record<Exclude<Engine, 'sqlite'>, Driver> = {
  pg: {
    packages: ['pg'],
    dialect: (url, [pg]) => new PostgresDialect({ pool: new pg.Pool({ connectionString: url }) }),
  },
  mysql: {
    packages: ['mysql2'],
    dialect: (url, [mysql]) => new MysqlDialect({ pool: mysql.createPool(url) }),
  },
  mssql: {
    packages: ['tedious', 'tarn'],
    dialect: (url, [tedious, tarn]) => new MssqlDialect({
      tarn: { ...tarn, options: { min: 0, max: 10 } },
      tedious: { ...tedious, connectionFactory: () => new tedious.Connection(tediousConfig(url)) },
    }),
  },
};

/** The dialect `url` names, over the driver the app installed beside it. */
export function dialectFor(engine: Exclude<Engine, 'sqlite'>, url: string, from = process.cwd()): KyselyDialect {
  const driver = DRIVERS[engine];
  const require = createRequire(join(from, 'package.json'));
  const modules = driver.packages.map((name) => {
    try {
      return require(name);
    } catch {
      throw new Error(
        `dialect '${engine}' needs its driver, and '${name}' does not resolve from ${from} — `
        + `install it beside the app: pnpm add ${driver.packages.join(' ')}`,
      );
    }
  });

  return driver.dialect(url, modules);
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
