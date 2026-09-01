# @fougere/admin

## 0.6.0-alpha.0

### Minor Changes

- 934d74d: Go to definition lands on the code, not on a `.d.ts`.

  Every package compiles with `declarationMap`, so each `.d.ts` shipped a map pointing at
  `../../src/…` — and `"files": ["dist"]` left that target behind. The map resolved to
  nothing, in every editor, for every consumer. `src` is published now.

  Measured on `@fougere/core`: 233 → 334 kB packed, 854 kB → 1.3 MB unpacked. That is still
  below `kysely` (1.7 MB), which the same install pulls in anyway. What it buys is that a
  reader who follows a symbol arrives in the commented source rather than in a stripped
  signature — and in this codebase the comments carry the reasoning.

### Patch Changes

- Updated dependencies [8f390d0]
- Updated dependencies [b1e1133]
- Updated dependencies [5076973]
- Updated dependencies [cf5b52e]
- Updated dependencies [8f21270]
- Updated dependencies [6f08e19]
- Updated dependencies [934d74d]
- Updated dependencies [ff3cab8]
  - @fougere/core@0.5.0
  - @fougere/app@1.0.0
  - @fougere/schema@0.5.0

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

### Patch Changes

- Updated dependencies
- Updated dependencies [934d74d]
- Updated dependencies [ff3cab8]
  - @fougere/core@0.5.0-alpha.1
  - @fougere/app@1.0.0-alpha.1
  - @fougere/schema@0.5.0-alpha.1
