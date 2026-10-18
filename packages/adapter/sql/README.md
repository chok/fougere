# @fougere/adapter-sql
> Entity → SQL tables, through Kysely
The SQL realization of the schema: the tables, the additive migration and the
per-entity scoped storage. Four dialects — SQLite, PostgreSQL, MySQL, SQL Server.

Validation decides, storage realizes: this storage decides nothing of its own — it applies
the `lifecycle` rules on the way in. The shape is still held on this path, twice: the
DDL emits a `CHECK` for `oneOf`, `min` and `max`, and core's `StorageGuard` validates every
write through the port. `storage.client` meets neither.

## Installation
```bash
pnpm add @fougere/adapter-sql
```

```ts
// fougere.config.ts — the import registers the types, and makes them words the config may write
import '@fougere/adapter-sql';

export default defineFougere({
  sources: {
    main: { type: 'sqlite', path: '.data/app.db' },
    legacy: { type: 'pg', url: process.env.LEGACY, entities: ['Book'] },
  },
});
```

The entry loads on any runtime: an engine reads its driver, and SQLite `node:fs`, when it opens.
`type: 'd1'` with a `binding` opens a Cloudflare D1 database from inside a Worker.

---

Part of [Fougere](https://github.com/chok/fougere) — one schema, a gradient from
monolith to distributed, the same user code.
Reference documentation: [the site](https://fougere.dev/).
