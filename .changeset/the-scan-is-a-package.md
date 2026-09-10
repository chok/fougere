---
'@fougere/compiler': minor
'@fougere/core': minor
---

The scan is a package, and core states what it takes to fill a descriptor.

Reading a project's source is the one thing core did that needs a filesystem and a
TypeScript program, and it was the only reason `@typescript/typescript6` — 24 MB — was a
dependency of every install. The bundles never carried it: the loaders were already lazy,
so what moves is what an install downloads, not what a Worker runs.

`scanProject`, `emitScan`, `emitStatement`, `frondAliases`, `boot` and the two AST readers
now come from `@fougere/compiler`. `@fougere/core/node` keeps what needs a disk without a
compiler: the config loader, the module loader, the deployment keys.

The extraction forced a contract out of hiding. Fifteen symbols the scan reached for inside
core leave by `@fougere/core/descriptor`, a fourth entry that says what it takes to PRODUCE
a descriptor where the main one says what an app RUNS. `conventions` came back to core — it
names directories and reads nothing.
