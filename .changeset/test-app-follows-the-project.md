---
'@fougere/testing': patch
'@fougere/cli': patch
---

`testApp()` keeps a project's rows the way the project does: one naming no source is tested in memory, and no longer needs a SQLite driver it never installed — the starter's own boot test failed on every new project. The starter's vitest config lives in `tests/`, beside the test it runs.
