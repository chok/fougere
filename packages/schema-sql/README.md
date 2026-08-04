# @fougere/schema-sql
> Entity → SQL tables, through Kysely
The SQL realization of the schema: the tables, the additive migration and the
per-entity scoped ORM. Four dialects — SQLite, PostgreSQL, MySQL, SQL Server.

Validation judges, storage realizes: this ORM passes no judgment on what a handler
hands it — it applies the `lifecycle` rules.

## Installation
```bash
pnpm add @fougere/schema-sql
```

---

Part of [Fougere](https://github.com/chok/fougere) — one schema, a gradient from
monolith to distributed, the same user code.
Reference documentation: [the site](https://chok.github.io/fougere/) (en/fr).
