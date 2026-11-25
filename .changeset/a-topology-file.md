---
'@fougere/core': minor
'@fougere/defaults': minor
'@fougere/cli': minor
'@fougere/app': minor
'@fougere/nuxt': minor
'@fougere/testing': minor
'@fougere/compiler': patch
---

Where a frond runs is `processes:` in `fougere.config.ts`: each process with its `url` and the fronds it runs, `{ blog: { url: 'http://127.0.0.1:4100', fronds: ['blog'] } }`. An app is every frond `processes:` places nowhere, and starts with no name; a process starts with `fougere serve <process>` or `fougere dev <process>`. A process naming a frond the project does not have refuses to start. `remote:` on a `fronds:` entry, `only:` on `bootApp` and `FOUGERE_FRONDS` are gone.
