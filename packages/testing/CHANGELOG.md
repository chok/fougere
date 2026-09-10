# @fougere/testing

## 0.8.4-alpha.0

### Patch Changes

- 32923e6: An axis answers questions, and keeps no member to answer for it.

  `Role`, `Lifecycle` and `Boundary` no longer declare `implements RoleRules` /
  `LifecycleRules` / `BoundaryRules`, which was what forced their members public. Nothing
  was annotating a `Role` as a `RoleRules`, but `readOnly()` and `writeOnly()` were writing
  a JUDGE into `field.boundary` through the structural match: `Boundary.with` becomes
  `Boundary.declaring` and returns the declaration, the dual of `Boundary.declared`.

  Two questions a caller was asking by hand now exist. `Role.isRelation` answers either
  kind — `@fougere/cli` and `@fougere/testing` were reading `.relation` for it — and
  `Role.onDelete` completes `target`. `Lifecycle.stampedAtCreate` is what `Visibility.input`
  and `applyCreate` were spelling as `create === 'now'`; `stampedOnce` now derives from it.

  `Schema.fields`, `.adapters` and `.opts` are gone. They were a second spelling of
  `getFields()` / `getAdapters()` / `getOpts()` that `SchemaConstructor` never declared, so
  no consumer could reach them in TypeScript. `SchemaView` is the contract, unchanged.

  `Bundle.fromSchemas` was building a whole card per entry to read one title; `Card.titleOf`
  answers it, and a derivation still reports the name it was cut from.

- 771e703: The type a projection dispatches on, named once and imported from the standard.

  Nine places re-derived the same partition of shapes — two in `@fougere/app`'s form, one in
  `@fougere/core`'s criterion, five in `@fougere/adapter-sql`, one in `@fougere/cli` — and it
  had already diverged twice: `controlOf` had no `object|array` branch that its twin
  `renderOf` carries, and `pothos.ts` documents its own bug, a bounded set falling through to
  `String`.

  `Shapes.typeOf(shape)` answers `ShapeType`, which is `JSONSchema7TypeName` from
  `@types/json-schema` less `null` — a shape states that as the `[T,'null']` union — with
  `string` in the three forms this package actually tells apart: `date`, `choice`, `text`.
  Those three are the whole of what is ours; the rest is the standard's, and a type assertion
  fails the build if `SHAPE_TYPES` and the standard ever part ways.

  `Shapes.isNullable` stays: nullability is not a type, it is the other half of `Shapes.of`.

  `@fougere/app`'s two cascades are now `Record<ShapeType, …>` tables, which no longer compile
  if a type is left out. `@fougere/adapter-sql` and `@fougere/cli` still hold theirs.

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
  - @fougere/container@0.8.3-alpha.1
  - @fougere/adapter-graphql@0.8.3-alpha.1
  - @fougere/app@0.8.3-alpha.1
  - @fougere/compiler@1.0.0-alpha.1
  - @fougere/defaults@0.8.3-alpha.1
  - @fougere/transport-http@0.8.3-alpha.1

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
  - @fougere/defaults@0.8.1-alpha.0
  - @fougere/transport-http@0.8.1-alpha.0

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
  - @fougere/defaults@0.8.0-alpha.0
  - @fougere/app@0.8.0-alpha.0
  - @fougere/transport-http@0.8.0-alpha.0

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
  - @fougere/adapter-graphql@0.6.0-alpha.1
  - @fougere/core@0.6.0-alpha.1
  - @fougere/defaults@0.6.0-alpha.1
  - @fougere/app@0.6.0-alpha.1
  - @fougere/transport-http@0.6.0-alpha.1

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
  - @fougere/defaults@0.5.0
  - @fougere/app@1.0.0
  - @fougere/container@0.5.0
  - @fougere/schema@0.5.0
  - @fougere/adapter-graphql@0.5.0
  - @fougere/transport-http@0.5.0

## 1.0.0-alpha.1

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
  - @fougere/adapter-graphql@0.5.0-alpha.1
  - @fougere/app@1.0.0-alpha.1
  - @fougere/container@0.5.0-alpha.1
  - @fougere/defaults@0.5.0-alpha.1
  - @fougere/schema@0.5.0-alpha.1
  - @fougere/transport-http@0.5.0-alpha.1
