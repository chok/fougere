---
'@fougere/core': minor
'@fougere/compiler': minor
'@fougere/vite': minor
'@fougere/nuxt': minor
'@fougere/next': minor
'@fougere/testing': minor
'@fougere/cli': minor
---

`@fronds/<name>` resolves by the `paths` of `@fougere/core/tsconfig` — `fronds/<name>`, then
`.fougere/remotes/<name>` — on every host, so a frond created while a dev server runs answers at its first
import, with no install. A frond named apart from its directory is a `paths` entry of
`fronds/tsconfig.json`: `fougere.frond` in a `package.json` is no longer read. `fougere sync` writes no
`package.json`. `fougereTest()` returns a promise, and resolves `@fronds/<name>` in a test.
