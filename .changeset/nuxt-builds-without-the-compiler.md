---
'@fougere/nuxt': minor
'@fougere/app': minor
'@fougere/core': minor
'@fougere/compiler': minor
---

A Nuxt app that writes its `fronds.ts` builds without `@fougere/compiler`: it is an optional peer of
`@fougere/nuxt` and `@fougere/app`, imported only to scan a project that wrote none, and kept out of
the server bundle. `frondAliases`, `emitFacade`, `emitNames`, `facadeModule` and `codesOf` move to
`@fougere/core/node` — they read descriptors, not sources, so a stated app writes its page types too.
