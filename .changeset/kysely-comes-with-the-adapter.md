---
'@fougere/adapter-sql': minor
'@fougere/oclif': patch
'@fougere/cli': patch
---

`kysely` is a dependency of `@fougere/adapter-sql`, no longer a peer: an app installs the adapter and the driver of its engine, nothing else. The oclif and frond starters stop listing it, and the oclif starter no longer installs `better-sqlite3`.
