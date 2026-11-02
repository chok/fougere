---
'@fougere/cli': minor
---

A new project is a workspace only once it has an app: `--bare` writes no `workspaces` and no pnpm `packages:`, and adding an app writes `apps/*`, so the root and the app install one `@fougere/core`. The starter's pnpm config no longer exempts `@fougere/*` from a release delay the user set.
