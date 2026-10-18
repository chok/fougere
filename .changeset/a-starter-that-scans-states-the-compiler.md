---
'@fougere/nuxt': patch
'@fougere/next': patch
'@fougere/react': patch
'@fougere/svelte': patch
---

The starters that scan state `@fougere/compiler`, which the hosts no longer bring: a dev dependency
for Nuxt, which scans at build, and a dependency for Next, React and SvelteKit, whose server scans
when it boots.
