# @fougere/adapter-sql
> Entity → SQL tables, through Kysely
The SQL realization of the schema: the tables, the additive migration and the
per-entity scoped storage. Four dialects — SQLite, PostgreSQL, MySQL, SQL Server.

Validation judges, storage realizes: this storage decides nothing of its own — it applies
the `lifecycle` rules on the way in. The shape is still held on this path, twice: the
DDL emits a `CHECK` for `oneOf`, `min` and `max`, and core's `StorageGuard` judges every
write through the port. `storage.client` meets neither.

## Installation
```bash
pnpm add @fougere/adapter-sql
```

---

Part of [Fougere](https://github.com/chok/fougere) — one schema, a gradient from
monolith to distributed, the same user code.
Reference documentation: [the site](https://fougere.dev/) (en/fr).
