---
'@fougere/core': patch
---

An edge bundle no longer drags `node:path` in through `frond()`.

`frond()` sits in `index` so an app can state what it hosts without a scanner, and it
reached `conventions.ts`, whose one `join` put `node:path` in front of esbuild — which
refused the Worker by name. `watchPathsOf` turns convention names into disk paths, so it
now sits beside the scan that reads them.
