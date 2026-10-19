---
'@fougere/nuxt': patch
'@fougere/next': patch
'@fougere/vite': patch
'@fougere/core': patch
'@fougere/compiler': patch
---

A Nuxt build counts a relative source path from the directory its server starts in — a build runs
elsewhere, and an image refused on `mkdir '/repo/site/.data'` while its volume sat at `/app/.data`;
`nuxt dev` keeps the project's root. `RUNTIME_PACKAGES` moves to `@fougere/core/node`, so
`next.config` no longer loads the compiler at `next start`. The statement writes error codes as
`ErrorCode` members, so a host that type-checks it — Next does — accepts it.
