---
'@fougere/nuxt': patch
'@fougere/compiler': patch
---

A Nuxt server build keeps every package `fougere.config.ts` imports or names in `fronds:`, whoever published it. It used to keep `@fougere/*` by name, so a third party's adapter imported for its effect was dropped from the build.
