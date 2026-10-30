---
'@fougere/cli': minor
---

A new project names no database: `fougere new` writes no `sources:`, no `@fougere/adapter-sql`, no `better-sqlite3` and no `migrate` script, so its rows stay in memory and the boot warns. One entry in `sources:` and the `migrate` script keep them in SQLite.
