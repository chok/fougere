---
'@fougere/core': minor
'@fougere/adapter-sql': minor
'@fougere/adapter-duckdb': patch
'@fougere/testing': patch
'@fougere/cli': patch
---

Every entry of `sources:` writes its `type`. An entry with none used to be SQLite once
`@fougere/adapter-sql` was imported, and `{}` a SQLite file named `fougere.db` — a meaning that
depended on what the config happened to import. It is refused now, naming the types the process
answers: `sources.main has no \`type\`. This process answers sqlite, pg, mysql, mssql, d1.`

Write `main: { type: 'sqlite', path: '.data/app.db' }`. The only default left is no `sources:` at
all, which keeps the rows in memory and says so. `Sources.byConvention` is removed.
