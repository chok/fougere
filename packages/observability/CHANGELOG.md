# @fougere/observability

## 0.29.0-alpha.1

### Patch Changes

- Released with every other package, so a project scaffolded at this version finds all of them.

## 0.28.0-alpha.2

### Patch Changes

- Updated dependencies [f1d2704]
- Updated dependencies [aea7c71]
- Updated dependencies [5f1c3ca]
- Updated dependencies [5b1ad11]
- Updated dependencies [5f1c3ca]
- Updated dependencies [10df4b0]
- Updated dependencies [9d69fcd]
- Updated dependencies [4da370e]
- Updated dependencies [5f1c3ca]
- Updated dependencies [97fbc58]
- Updated dependencies [08c7bc1]
- Updated dependencies [1ea472e]
- Updated dependencies [6d694d1]
- Updated dependencies [5f1c3ca]
- Updated dependencies [5f1c3ca]
- Updated dependencies [d7cde0c]
- Updated dependencies [57ddbb7]
- Updated dependencies [9e17181]
- Updated dependencies [d4eab03]
- Updated dependencies [6b84cec]
- Updated dependencies [87a261d]
- Updated dependencies [f7ccbed]
  - @fougere/core@1.0.0-alpha.1

## 0.8.4-alpha.0

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies [771e703]
  - @fougere/core@0.9.0-alpha.1

## 0.8.3-alpha.0

### Patch Changes

- Updated dependencies
  - @fougere/core@0.8.3-alpha.0

## 0.8.2-alpha.0

### Patch Changes

- Updated dependencies [fb256c1, c1ad40c]
  - @fougere/core@0.8.2-alpha.0

## 0.7.0-alpha.0

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
