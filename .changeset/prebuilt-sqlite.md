---
'@fougere/app': patch
'@fougere/auth-better': patch
'@fougere/cli': patch
'@fougere/cli-ui': patch
'@fougere/container': patch
'@fougere/core': patch
'@fougere/decorators': patch
'@fougere/http': patch
'@fougere/next': patch
'@fougere/nuxt': patch
'@fougere/react': patch
'@fougere/runtime': patch
'@fougere/schema': patch
'@fougere/schema-graphql': patch
'@fougere/schema-rest': patch
'@fougere/schema-sql': patch
'@fougere/svelte': patch
'@fougere/transport-http': patch
'@fougere/vite': patch
'create-fougere': patch
'fougere': patch
---

Nothing downloads or compiles when you install.

`better-sqlite3` moves to 13, which carries its prebuilt binaries inside the tarball
(`prebuilds/darwin-arm64.node`, `linux-x64`, `linuxmusl`, `win32-arm64`, …). Version 12
fetched one at install time through `prebuild-install`, a package that is no longer
maintained and that printed a deprecation warning on every `create fougere`.

Measured on a bare install: no deprecation line, no `build/` directory, no `node-gyp`, no
Python, 9.6 s — and it works offline, which the download never did.

The scaffold templates move with it, since that is where a new app met the warning.
