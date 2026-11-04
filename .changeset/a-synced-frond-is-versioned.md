---
'@fougere/core': minor
'@fougere/cli': minor
'@fougere/next': minor
'@fougere/nuxt': minor
'@fougere/testing': minor
---

`fougere sync` writes `remotes/<name>/` at the root of the project, and that directory is committed: only the far side can write it again, so a fresh clone compiles with no host running. `.fougere/remotes.json` is gone, since its path follows from the name and nothing read its url. Move `.fougere/remotes/` to `remotes/`, and change `.fougere/remotes/` to `remotes/` in any `paths` of your own. `SyncedRemote` has no `url` any more.
