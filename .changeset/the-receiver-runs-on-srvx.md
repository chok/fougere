---
'@fougere/transport-http': minor
'@fougere/app': patch
---

`serve()` listens through srvx rather than `node:http`, so `fougere serve` and every receiver answer
the same on Node, Bun and Deno, and `beside` is handed the `Request` srvx built instead of a copy.
A POST that declares no body — what `curl -X POST` writes — reads as no body before its type is
judged, where it used to be refused as not JSON once a stream arrived with it.
