---
'@fougere/schema': minor
'@fougere/adapter-sql': minor
---

Breaking: `primary()` generates a UUIDv7 — `cuid2` cost about 90 µs an id — stored as `uuid` on Postgres, as is every `ref()` to it. A table made before keeps its key as `text`, and the boot refuses it by name: convert the column, or keep `primary({ generate: 'cuid2' })`. A project that froze its schema freezes again. Table and route names share one pluralization (`categorys` is now `categories`), and a `bigint` column reads back as a number.
