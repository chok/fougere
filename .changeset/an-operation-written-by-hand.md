---
'@fougere/core': minor
'@fougere/cli': minor
---

A `fronds.ts` written by hand states a method's contract in the words TypeScript erases —
`operations: { publish: { params: { id: [Post, 'id'] }, output: Post } }` — and `frond()` reads it into
the signature the boot binds from. Nothing is guessed: what the file does not list is not served.
`fougere check` reads the sources and names a public method (`operation-unstated`) or a handler
(`handler-unstated`) the file leaves out; a `private` or `protected` one is never named.
