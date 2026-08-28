---
'@fougere/adapter-duckdb': minor
'@fougere/adapter-graphql': minor
'@fougere/adapter-rest': minor
'@fougere/adapter-sql': minor
'@fougere/admin': minor
'@fougere/next': minor
'@fougere/nuxt': minor
'@fougere/react': minor
'@fougere/app': minor
'@fougere/svelte': minor
'@fougere/vite': minor
'@fougere/auth-better': minor
'@fougere/cli': minor
'@fougere/container': minor
'@fougere/core': minor
'@fougere/decorators': minor
'@fougere/defaults': minor
'create-fougere': minor
'fougere': minor
'@fougere/http': minor
'@fougere/observability': minor
'@fougere/schema': minor
'@fougere/testing': minor
'@fougere/transport-http': minor
---

Go to definition lands on the code, not on a `.d.ts`.

Every package compiles with `declarationMap`, so each `.d.ts` shipped a map pointing at
`../../src/…` — and `"files": ["dist"]` left that target behind. The map resolved to
nothing, in every editor, for every consumer. `src` is published now.

Measured on `@fougere/core`: 233 → 334 kB packed, 854 kB → 1.3 MB unpacked. That is still
below `kysely` (1.7 MB), which the same install pulls in anyway. What it buys is that a
reader who follows a symbol arrives in the commented source rather than in a stripped
signature — and in this codebase the comments carry the reasoning.
