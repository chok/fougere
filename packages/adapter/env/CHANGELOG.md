# @fougere/adapter-env

## 0.29.0-alpha.1

### Patch Changes

- Updated dependencies [081f171]
  - @fougere/core@0.29.0-alpha.1

## 0.28.0-alpha.2

### Minor Changes

- 97fbc58: `sources:` lists `rows:` and `values:`, where it listed `entities:`. An entity in `values:` is
  injected as ONE value — `constructor(meili: Meili)` — read, completed by its defaults and judged at
  boot. `@fougere/adapter-env` reads it from `MEILI_URL`; a source holding rows keeps it as a
  `FougereValue` row, a file source as one file. The default source is the writable entry with no
  `rows:`; when every entry lists its rows, an entity left out refuses the boot.

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
  - @fougere/schema@0.28.0-alpha.1
