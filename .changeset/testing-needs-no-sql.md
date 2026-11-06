---
'@fougere/testing': patch
---

`testApp()` no longer loads `@fougere/adapter-sql`: a project's config imports the adapter it names, and only `statementsOf` needs it. A required peer that yarn 4 does not install stopped a new project's `yarn test`.
