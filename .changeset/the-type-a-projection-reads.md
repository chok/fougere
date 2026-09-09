---
'@fougere/schema': minor
'@fougere/app': patch
'@fougere/core': patch
'@fougere/testing': patch
---

The type a projection dispatches on, named once and imported from the standard.

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
