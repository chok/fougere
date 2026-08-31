# @fougere/observability

## 0.5.0-alpha.1

### Minor Changes

- 934d74d: Go to definition lands on the code, not on a `.d.ts`.

  Every package compiles with `declarationMap`, so each `.d.ts` shipped a map pointing at
  `../../src/…` — and `"files": ["dist"]` left that target behind. The map resolved to
  nothing, in every editor, for every consumer. `src` is published now.

  Measured on `@fougere/core`: 233 → 334 kB packed, 854 kB → 1.3 MB unpacked. That is still
  below `kysely` (1.7 MB), which the same install pulls in anyway. What it buys is that a
  reader who follows a symbol arrives in the commented source rather than in a stripped
  signature — and in this codebase the comments carry the reasoning.
