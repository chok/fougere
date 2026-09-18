---
'@fougere/schema': patch
'@fougere/container': patch
'@fougere/core': patch
---

An error names itself with a literal, so a bundler cannot rename it.

`new.target.name` is mangled in a browser bundle: measured in the site's build, `SchemaError`
ships as `class e extends Error`, and every refusal raised there was named `e`.
