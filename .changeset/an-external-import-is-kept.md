---
'@fougere/nuxt': patch
'@fougere/core': patch
---

`nuxt dev` keeps `import '@fougere/adapter-sql'` in the config: Nitro reads no `sideEffects` of a
module it leaves external, and dropped it, so the boot found no source type. The refusal for an
untyped source now says the bundler may have dropped the import, and names the types the process
answers.
