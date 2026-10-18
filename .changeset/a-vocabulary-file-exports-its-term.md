---
'@fougere/registry': minor
'@fougere/schema': minor
'@fougere/core': minor
'@fougere/compiler': minor
'@fougere/defaults': minor
'@fougere/app': minor
'@fougere/nuxt': minor
---

A `vocabulary/` file exports its term, and the process lists it beside its fronds.

`export const slug = StringFormats.term('slug', …)` — `Registry.term` on every registry, `Verbs.term`
included — and `export const vocabulary = [slug]` in `fronds.ts`, which the scan writes and every
host hands to `createApp({ vocabulary })`. An entity still names the word (`format: 'slug'`). A file
that registered at module level was imported for that effect alone, and Nitro dropped it from
`demos/nuxt-blog`'s server build: a 500 at the first write. A term an entity names and nothing in
the process answers now refuses the boot (`term-missing`), over `NamedTerm.in(schema)`.
