---
'@fougere/core': minor
'@fougere/transport-http': minor
'@fougere/defaults': minor
'@fougere/app': patch
'@fougere/testing': patch
---

The scheme of `remote:` names the transport that carries the call: `@fougere/transport-http` registers `http`, `https` and `binding` (a Cloudflare service binding, `binding://CATALOG`), and `Transports.register('tcp', …)` adds another. A scheme nothing registered refuses the boot, naming the entry. `remoteTransport()` is gone from `@fougere/defaults`; `remoteTransport:` remains the host's way to replace the transport whole.
