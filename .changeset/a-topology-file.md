---
'@fougere/core': minor
'@fougere/defaults': minor
'@fougere/cli': minor
'@fougere/app': minor
'@fougere/nuxt': minor
'@fougere/testing': minor
'@fougere/compiler': patch
---

Where a frond runs is written in `fougere.topology.yaml`, beside `fougere.config.ts`: the processes the app reaches, each with its `url` and its `fronds`. The app is every frond the file places nowhere, and starts with no name; a process starts with `fougere serve <process>`, `fougere dev <process>` or `FOUGERE_PROCESS`. `remote:` on a `fronds:` entry, `only:` on `bootApp` and `FOUGERE_FRONDS` are gone. A `url` reads the environment as Compose does: `${CATALOG_URL:-binding://CATALOG}`.
