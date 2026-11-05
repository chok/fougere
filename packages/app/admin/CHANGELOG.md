# @fougere/admin

## 0.30.0-alpha.0

### Patch Changes

- Updated dependencies [4c0ebd2]
- Updated dependencies [aa2be0c]
- Updated dependencies [565ca0f]
- Updated dependencies [50e1b8d]
- Updated dependencies [85aff54]
- Updated dependencies [2d67956]
- Updated dependencies [85aff54]
  - @fougere/schema@0.30.0-alpha.0
  - @fougere/core@0.30.0-alpha.0
  - @fougere/app@0.30.0-alpha.0

## 0.29.0-alpha.3

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @fougere/schema@0.29.0-alpha.3
  - @fougere/core@0.29.0-alpha.3
  - @fougere/app@0.29.0-alpha.3

## 0.29.0-alpha.2

### Patch Changes

- @fougere/app@0.29.0-alpha.2
- @fougere/core@0.29.0-alpha.2
- @fougere/schema@0.29.0-alpha.2

## 0.29.0-alpha.1

### Patch Changes

- Updated dependencies [081f171]
  - @fougere/core@0.29.0-alpha.1
  - @fougere/app@0.29.0-alpha.1

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
- Updated dependencies [49cbfde]
- Updated dependencies [6d694d1]
- Updated dependencies [5f1c3ca]
- Updated dependencies [2a6116c]
- Updated dependencies [5f1c3ca]
- Updated dependencies [d7cde0c]
- Updated dependencies [c3da0be]
- Updated dependencies [57ddbb7]
- Updated dependencies [9e17181]
- Updated dependencies [890af9b]
- Updated dependencies [a6b601b]
- Updated dependencies [d4eab03]
- Updated dependencies [6b84cec]
- Updated dependencies [87a261d]
- Updated dependencies [f7ccbed]
- Updated dependencies [487f25b]
  - @fougere/core@1.0.0-alpha.1
  - @fougere/schema@0.28.0-alpha.1
  - @fougere/app@1.0.0-alpha.1

## 0.8.4-alpha.0

### Patch Changes

- Updated dependencies [26f7987]
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies [32923e6]
- Updated dependencies
- Updated dependencies
- Updated dependencies [771e703]
  - @fougere/schema@0.9.0-alpha.1
  - @fougere/core@0.9.0-alpha.1
  - @fougere/app@0.8.3-alpha.1

## 0.8.3-alpha.0

### Patch Changes

- Updated dependencies
  - @fougere/core@0.8.3-alpha.0
  - @fougere/schema@0.8.3-alpha.0

## 0.8.2-alpha.0

### Patch Changes

- Updated dependencies [fb256c1, c1ad40c]
  - @fougere/core@0.8.2-alpha.0
  - @fougere/schema@0.8.2-alpha.0

## 0.8.1-alpha.0

### Patch Changes

- Updated dependencies [9d24851]
  - @fougere/core@0.8.1-alpha.0
  - @fougere/app@0.8.1-alpha.0

## 0.8.0-alpha.0

### Patch Changes

- Updated dependencies [6ec8e59]
- Updated dependencies [2478927]
- Updated dependencies [525b53e]
- Updated dependencies [34fbd31]
- Updated dependencies [089ebb9]
- Updated dependencies [f9b5837]
- Updated dependencies [ae49d25]
- Updated dependencies [6d9034d]
- Updated dependencies [c5f5791]
- Updated dependencies [4287ac9]
  - @fougere/core@0.8.0-alpha.0
  - @fougere/app@0.8.0-alpha.0

## 0.7.0-alpha.0

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies [7376ae7]
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies [47513d2]
  - @fougere/schema@0.6.0-alpha.1
  - @fougere/core@0.6.0-alpha.1
  - @fougere/app@0.6.0-alpha.1

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
