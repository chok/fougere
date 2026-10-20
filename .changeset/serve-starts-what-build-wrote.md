---
'@fougere/cli': minor
'@fougere/compiler': minor
'@fougere/defaults': minor
'@fougere/core': minor
---

`fougere serve` starts what `fougere build` wrote in `.fougere/build/`, with Node alone — no loader, no
TypeScript — and refuses without a build. `fougere dev` is what `serve --watch` was, and watches the
fronds again: since boots read a statement, `--watch` watched nothing. `bootApp(root, { built })` boots a
compiled project. Needs Node 22.15, or Bun.
