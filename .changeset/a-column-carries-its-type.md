---
'@fougere/adapter-sql': minor
---

A column carries the type its projections read, and `ColumnShape` is gone.

`ColumnShape` was `Shape` restated weaker — `type?: string`, `format?: string` — and its
only readers were the four `columnType` switches, each re-deriving what `Shapes.typeOf`
answers. `ColumnDef.type` is a `ShapeType` now, posed once by `toTable`.

`codecFor` takes that type rather than a shape, and its table is exhaustive: a type left
out no longer compiles, where the old `switch` re-tested `format === 'date-time'` on its
own. The four dialects keep their `switch` — a `default:` there decides ("everything else
is text") rather than forgetting, and no engine tells a date apart from a string.

The SQL emitted is unchanged: `date` and `choice` land in the same `default` branch that
`string` landed in.
