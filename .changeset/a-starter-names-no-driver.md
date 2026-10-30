---
'@fougere/nuxt': patch
'@fougere/next': patch
'@fougere/react': patch
'@fougere/svelte': patch
---

An app's starter no longer installs `better-sqlite3` and `kysely`. A project keeps its rows in memory until it names a source, and the project that names one installs `@fougere/adapter-sql` and its driver.
