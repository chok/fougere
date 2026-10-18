---
'@fougere/core': minor
'@fougere/compiler': minor
---

The statement the scan writes brings a frond back whole: its middlewares in their order, its
extensions and its seeds by import, its `frond.config.ts` by import, and the type of each computed
field.

`frond()` takes `config:` — the frond's `frond.config.ts` — and reads it the way the scan does
(`FrondConfigReading`, `@fougere/core/descriptor`), and a presenter's `fieldMeta`. Under Nuxt a
frond booted from a statement ran none of its middlewares.
