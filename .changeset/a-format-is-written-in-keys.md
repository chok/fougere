---
'@fougere/schema': minor
'@fougere/adapter-sql': patch
---

`Format` writes the JSON Schema, so an axis states its keys and never a document.

`Format.of('axis/lifecycle').key('create', …).closed()` produces the `$id`, the `$ref`, the
`$defs` and the closing; `LIFECYCLE_FORMAT`, `ROLE_FORMAT`, `BOUNDARY_FORMAT` and the adapter's
`adapter.schema.json` are gone with the literals they held. An object closes with
`propertyNames`, so an unknown key is refused under its own name and the message lists the legal
ones: `lifecycle.craete: Instance does not match any of ["create","update"]`.
