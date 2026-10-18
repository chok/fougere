---
'@fougere/defaults': minor
'@fougere/compiler': minor
'@fougere/core': minor
---

The conventional boot moved from `@fougere/compiler` to `@fougere/defaults`, and it scans only when
the project writes no `fronds.ts`.

`import { boot } from '@fougere/defaults'` replaces `'@fougere/compiler'`. `@fougere/compiler` is
now an optional peer of `@fougere/defaults`: a project that scans installs it, a project that writes
its fronds by hand never loads it — nor TypeScript. `statementFileIn` (`@fougere/core/node`) is the
one place that knows the file names a statement takes.
