---
'@fougere/nuxt': patch
'@fougere/app': patch
---

The published Nuxt module ships the runtime it points the host at.

`src/runtime` sat outside the build because three of its files import `#imports`, so
four released versions carried raw `.ts` and `nuxt dev` died in Rollup on the first
file it bundled — reproducible in five minutes from `npm create fougere`, invisible to
every check that reads the workspace, where pnpm links make `src/` and `dist/` alike.

A shim states where Nuxt types its virtual barrel, and `pnpm door:check` packs every
package, scaffolds outside the workspace, installs the tarballs and boots: it fails on
the four published versions and passes here.

`@fougere/app` carried the repo's only hand-written @fougere range, `^0.3.0-alpha.0`,
which semver does not satisfy with `0.4.0-alpha.0`.
