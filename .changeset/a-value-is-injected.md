---
'@fougere/core': minor
'@fougere/defaults': minor
'@fougere/schema': minor
'@fougere/adapter-file': minor
'@fougere/adapter-duckdb': minor
'@fougere/adapter-env': minor
---

`sources:` lists `rows:` and `values:`, where it listed `entities:`. An entity in `values:` is
injected as ONE value — `constructor(meili: Meili)` — read, completed by its defaults and judged at
boot. `@fougere/adapter-env` reads it from `MEILI_URL`; a source holding rows keeps it as a
`FougereValue` row, a file source as one file. The default source is the writable entry with no
`rows:`; when every entry lists its rows, an entity left out refuses the boot.
