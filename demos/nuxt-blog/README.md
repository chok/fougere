
## Production — two things to know

`pnpm build` must be run **from the workspace root** (`pnpm -r build`) or through
`npx nuxt build`. This demo declares its own nested `pnpm-workspace.yaml` for
`fronds/*`, so `pnpm build` from inside resolves dependencies against that inner
workspace and fails on `@fougere/container-fougere`.

And the built `.output` does not run as-is: Nitro's production trace misses packages
that are imported lazily under pnpm, `jiti` among them, so the server starts and then
answers `Cannot find module .../jiti/lib/jiti.mjs` on the first call that needs the
scan. This is the limitation `CLAUDE.md` records; `site/Dockerfile` works around it by
re-adding `jiti` and TypeScript by hand after the build. This demo has no deployment
path of its own, so it is stated here rather than papered over.

`pnpm dev` and `pnpm dev:blog` are unaffected.
