---
'@fougere/adapter-sql': patch
'@fougere/adapter-rest': patch
'@fougere/adapter-graphql': patch
'@fougere/adapter-memory': patch
'@fougere/adapter-file': patch
'@fougere/nuxt': minor
'@fougere/compiler': minor
---

An adapter states in its `package.json` (`sideEffects`) the entry an app imports for its effect and
the file that registers, so a bundler keeps `import '@fougere/adapter-sql'`. `@fougere/nuxt` no longer
reads the config with TypeScript to keep it, and `packagesImportedBy` is gone. A third party's adapter
states its own `sideEffects`.
