# @fougere/log

## 0.31.0-alpha.0

### Minor Changes

- 0c8aa7c: `log()` writes the two lines of each call and nothing else; the file is its own extension, `file(path)`, which every line of the process reaches. `log(path)` is gone: write `platform: [log(), file(path)]`.

### Patch Changes

- 31b9608: What a process carries is `platform:`: the extensions it mounts, imported from their package — `platform: [log()]`. A process of `processes:` states its own list or carries the config's, exactly the list; to add to the default, spread it. An extension written under `fronds:` (`'@fougere/log': {}`) now refuses the boot, naming the `platform:` line to write.
- Updated dependencies [31b9608]
- Updated dependencies [954f02e]
- Updated dependencies [640b512]
  - @fougere/core@0.31.0-alpha.0
  - @fougere/schema@0.31.0-alpha.0

## 0.30.0-alpha.7

### Patch Changes

- @fougere/core@0.30.0-alpha.7
- @fougere/schema@0.30.0-alpha.7

## 0.30.0-alpha.6

### Patch Changes

- Updated dependencies
  - @fougere/core@0.30.0-alpha.6
  - @fougere/schema@0.30.0-alpha.6

## 0.30.0-alpha.5

## 0.30.0-alpha.4

## 0.30.0-alpha.3

## 0.30.0-alpha.2

## 0.30.0-alpha.1

## 0.30.0-alpha.0

## 0.29.0-alpha.3

## 0.29.0-alpha.2

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
