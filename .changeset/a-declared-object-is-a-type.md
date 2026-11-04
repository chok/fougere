---
'@fougere/adapter-graphql': minor
---

A field holding `json(Entity)` is a GraphQL type on both sides, at any depth, where it was a `String` on its own. Selecting one now needs subfields, and an input takes an object. A `writeOnly` field stays out of the output type. A bare `json()` remains a `String`.
