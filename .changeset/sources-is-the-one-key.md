---
'@fougere/core': minor
'@fougere/defaults': minor
'@fougere/adapter-sql': minor
'@fougere/adapter-file': minor
'@fougere/adapter-memory': minor
'@fougere/adapter-duckdb': minor
'@fougere/adapter-rest': minor
'@fougere/adapter-graphql': minor
'@fougere/app': minor
'@fougere/nuxt': minor
'@fougere/vite': minor
'@fougere/compiler': minor
'@fougere/testing': minor
'@fougere/cli': minor
---

Breaking. `db:` is gone: `sources:` names every place rows live, and the entry listing no `entities` holds the rest. An entry names its engine with `type:` — `sqlite` by default, `pg`, `mysql`, `mssql`, `d1`, `file`, `memory` — and `dialect` and `source:` are gone. Nothing is imported for the app: a config imports `@fougere/adapter-sql` (and `-file`, `-memory`), and that import is what makes a type available and writable; `@fougere/adapter-sql/sqlite` is gone, the entry loads on any runtime. `adapters: { rest: true }` becomes `protocols: { rest: {} }` with `import '@fougere/adapter-rest'`; naming a protocol nothing imported refuses the boot.
