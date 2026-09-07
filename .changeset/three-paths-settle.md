---
"@fougere/core": patch
"@fougere/defaults": minor
"@fougere/nuxt": patch
"@fougere/app": patch
"@fougere/cli": patch
---

Three small ones, each a silence.

A relative `db.path` is counted from the config that named it, not from whoever is
running. `apps/nuxt` runs from its own directory and made a SECOND, empty database beside
itself while the workspace held the real one — nothing said, every table created, the
seeds run, an empty domain served with a green boot. `resolveStorage` takes a root;
`:memory:` and absolute paths pass through untouched, and the one case where the two
disagree is named rather than acted on silently.

A fresh project pins the version that scaffolded it. `latest` reads as "whatever is
current" and is not: pnpm answers from a metadata cache, and a fresh project installed
0.6 while the registry said 0.7.

And a convention directory that refuses a file says where it belongs — measured twice on
one project, both times a shared contract that had to move and nothing to say where.
