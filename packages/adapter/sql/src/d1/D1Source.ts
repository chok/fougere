import {
  SqliteAdapter, SqliteIntrospector, SqliteQueryCompiler,
  type DatabaseConnection, type Dialect, type Driver, type Kysely, type TransactionSettings,
} from 'kysely';
import { D1Dialect } from 'kysely-d1';
import { createKyselySource, type SqlSource } from '../source/SqlSource.js';

/** What a Worker binds — read off `env` at the first query, since nothing hands it over sooner. */
type Bindings = Record<string, unknown>;

/**
 * The binding exists only inside a Worker, and `cloudflare:workers` loads only there — so the
 * driver reaches it at `init()`, which Kysely already awaits, and opening stays synchronous.
 */
class BoundDriver implements Driver {
  private inner?: Driver;

  constructor(private readonly binding: string) {}

  async init(): Promise<void> {
    const workers = 'cloudflare:workers';
    const { env } = (await import(workers).catch(() => {
      throw new Error(`The d1 engine reads '${this.binding}' from cloudflare:workers, which this runtime has not.`);
    })) as { env: Bindings };
    const database = env[this.binding];
    if (!database) throw new Error(`The d1 engine found no binding '${this.binding}' on this Worker's env.`);

    this.inner = new D1Dialect({ database: database as never }).createDriver();
    await this.inner.init();
  }

  acquireConnection(): Promise<DatabaseConnection> {
    return this.opened().acquireConnection();
  }

  beginTransaction(connection: DatabaseConnection, settings: TransactionSettings): Promise<void> {
    return this.opened().beginTransaction(connection, settings);
  }

  commitTransaction(connection: DatabaseConnection): Promise<void> {
    return this.opened().commitTransaction(connection);
  }

  rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    return this.opened().rollbackTransaction(connection);
  }

  releaseConnection(connection: DatabaseConnection): Promise<void> {
    return this.opened().releaseConnection(connection);
  }

  async destroy(): Promise<void> {
    await this.inner?.destroy();
  }

  private opened(): Driver {
    if (!this.inner) throw new Error(`The d1 engine was used before '${this.binding}' was read.`);

    return this.inner;
  }
}

/** D1 is SQLite, so everything but the driver is SQLite's. */
class BoundDialect implements Dialect {
  constructor(private readonly binding: string) {}

  createAdapter() { return new SqliteAdapter(); }
  createDriver() { return new BoundDriver(this.binding); }
  createQueryCompiler() { return new SqliteQueryCompiler(); }
  createIntrospector(db: Kysely<any>) { return new SqliteIntrospector(db); }
}

export function createD1Source(binding: string): SqlSource {
  return createKyselySource(new BoundDialect(binding), 'sqlite', { name: binding });
}
