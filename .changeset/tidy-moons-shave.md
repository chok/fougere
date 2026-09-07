---
"@fougere/core": patch
"@fougere/app": patch
"@fougere/nuxt": patch
---

A web host applies the config it read. `applyConfig` had one caller, `boot()`, and the
front-end hosts reach `createApp` directly — so `logLevel:` was read and never acted on.
Its default now keeps the level the process already has, instead of raising every caller
to `debug`; and the Nuxt module says so when Nitro's console would drop that level.
