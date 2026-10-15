---
'@fougere/nuxt': patch
'@fougere/react': patch
'@fougere/app': patch
---

Under `nuxt dev`, a source imported in `fougere.config.ts` (`@fougere/adapter-file`) is no longer dropped. A query's `data` is `null` until it answers, on Nuxt 4.6. A create form opens again once its row is saved.
