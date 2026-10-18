---
'@fougere/core': minor
'@fougere/compiler': minor
'@fougere/defaults': minor
'@fougere/app': minor
'@fougere/nuxt': patch
---

`createApp` takes `fronds:` and nothing else — `scan:` is gone, and `emitScan` with it: every app boots
from a statement. `writeStatement(root)` and `writtenStatement(root, { only })` (`@fougere/compiler`)
write it from the sources and read it back; `statementIn(file, only)` (`@fougere/core/node`) reads one
with no compiler. An operation contract the scan could not decide refuses to be written. A statement
names an entity whose name is not its class's — `{ entity: Guest, name: 'guest' }`.
