---
'@fougere/defaults': minor
'@fougere/app': patch
---

`fougere serve` and `bootApp` now sign the calls they send to another process when `FOUGERE_KEY` is set, as Nuxt and Vite already did. Before, a receiver that required a signature refused them. The transport is `remoteTransport()`, exported by `@fougere/defaults`.
