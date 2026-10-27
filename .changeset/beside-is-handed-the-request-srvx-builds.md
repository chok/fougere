---
'@fougere/transport-http': patch
'@fougere/app': patch
---

`beside` is handed srvx's `NodeRequest` — read only as far as it is asked — instead of a copy of the
Node request, and its answer is written by `sendNodeResponse`. The envelope stays read off the Node
stream: through a Web `Request` a peer's call answered 29 % less. A POST that declares no body —
what `curl -X POST` writes — reads as no body before its type is judged.
