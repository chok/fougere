---
'@fougere/core': minor
'@fougere/nuxt': minor
'@fougere/app': minor
---

An app reads the nearest `fougere.config.ts`, up from where it runs, and its host's options
override it — a workspace's file and an app's are no longer folded into one (`loadCascadedConfig`
is gone, `loadNearestConfig` and `configFileNear` take its place). The `Config` builtin is gone too:
a value the app reads is an entity listed in `values:`, injected and judged at boot.
