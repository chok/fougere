---
'@fougere/core': patch
'@fougere/app': patch
---

A boot that refuses throws a `BootRefusal`. Under Nuxt, a call reaching an app that refused to boot answers `SERVICE_UNAVAILABLE` with the reason, and no stack.
