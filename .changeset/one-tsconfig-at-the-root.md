---
'@fougere/core': minor
'@fougere/cli': minor
'@fougere/next': patch
---

A project types its fronds from the `tsconfig.json` at its root, which covers `fougere.config.ts` too; each app under `apps/` keeps the one its tool wrote. A frond renamed by a `paths` entry is read there, no longer from `fronds/tsconfig.json`, and the starter's `typecheck` is `tsc`. `@fougere/next/route` hands Fougere the request alone: Next's own `{ params }` second argument was taken for the caller's state, and `next build` refused the route's type.
