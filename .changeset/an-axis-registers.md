---
'@fougere/schema': minor
---

An axis registers, and the format of a field is what the registry holds.

`Axes` is a `Registry<Axis>` carrying `role`, `lifecycle` and `boundary`, and
`Axes.register('tenancy', tenancyAxis)` is how a package outside `@fougere/schema` declares a
fourth: its key becomes legal, its format judges it, its slot is kept on the field and carried
by the card. `EXTENSION_AXES` and `EXTENSION_SLOTS` are gone — `Axes.all` and `Axes.names` say
the same thing and move when a registration does. `FougereFieldAxes` types what a declaration may
state, as `FougereEntityAdapters` already does for `adapters:`; reading a slot stays what the
three core axes do — `Lifecycle.of(field)` asks for the shape it reads, never for a `Field`.
