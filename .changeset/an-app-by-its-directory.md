---
'@fougere/core': minor
'@fougere/defaults': minor
'@fougere/app': minor
'@fougere/nuxt': minor
'@fougere/oclif': patch
---

An app is named by its directory under `apps/`, and carries its own list with `apps: { web: { platform: [...] } }`. The Nuxt module reads the name off its `rootDir`; a terminal passes `appNameOf(root, import.meta.dirname)` to `bootApp`. An entry naming no directory refuses the boot. The `calls` and `observability` options of the Nuxt module are gone: write them in `apps.<name>.platform`.
