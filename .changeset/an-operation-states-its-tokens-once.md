---
'@fougere/core': minor
'@fougere/compiler': minor
'@fougere/cli': minor
'@fougere/adapter-graphql': minor
'@fougere/adapter-rest': minor
'@fougere/admin': minor
'@fougere/calls': minor
---

An operation's words are written once: `OPERATION_KINDS`, `CARDINALITIES` and `PLACEMENTS`,
each with its type, where `'query' | 'command'` was spelled ten times and the cardinality three.
`CardOp` and `frond.config.ts`'s overrides derive from `OperationContract` and
`OperationOverride` instead of restating them.

An op's placement is flat — `op.frond`, `op.placement`, `op.remote` — where it was
`op.placement.runtime`, and `reach.fronds[]` says `placement` too. `fougere explain --json`
follows.

`fougere sync` writes the same refusals a scan does, the framework's included: one `codesOf`
for both. `@fougere/adapter-graphql` depends on `@fougere/core` and reads its types.
