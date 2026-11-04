---
'@fougere/compiler': minor
'@fougere/core': patch
---

An operation answering an entity beside another type (`Promise<Account | Receipt>`, `Promise<Account | string>`) refuses the boot with `output-contract-ambiguous`. It had no view, so it left whole, a `writeOnly` field included. `Promise<Account | null>` is unchanged, and `operations:` in `frond.config.ts` may state the output.
