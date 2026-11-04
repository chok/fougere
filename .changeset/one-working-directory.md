---
'@fougere/core': minor
'@fougere/cli': minor
'@fougere/vite': minor
'@fougere/next': minor
'@fougere/nuxt': minor
---

A project has one `.fougere/`, at its root: the facade and the names are written there by every host, and no app holds a copy, so `fougere build` is enough before `tsc` in a CI. In an app's tsconfig, `./.fougere/facade.generated.ts` becomes `../../.fougere/facade.generated.ts`. `@fougere/core/tsconfig` now states `include` — the fronds, the config and the names — so a wrong name in `fougere.config.ts` no longer compiles: remove your own `include` to get it. Next writes the names too, and a scan that fails under Vite or Next now says so.
