---
'@fougere/cli': patch
---

`fougere <op>` reads the type instead of re-testing the shape.

`entityToArgs` was spelling `shape?.type === 'string' && shape.format === 'date-time'` to
keep a date out of the positional slot — the test `Shapes.typeOf` owns. And `argFor`
decided which arguments carry a declared default with `type === 'string'`, one word that
covers three: a `text()`, a `date()` and a `oneOf()`. That is now a `Record<ShapeType,
boolean>`, so a type added to the vocabulary cannot slip through undeclared.

Same flags, same defaults, same `--help`.
