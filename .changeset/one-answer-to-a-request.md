---
'@fougere/app': minor
'@fougere/next': patch
'@fougere/vite': patch
'@fougere/cli': patch
---

`@fougere/app/web` answers a Web `Request` through one function: `answer(app, request)` routes it to
the call envelope, the session, REST or GraphQL by its path and answers `undefined` when none is its
own, and `fougere(request)` is the same for a host that routes by file — it boots the app, and a
request no door answers is a 404 that says why. `call`, `rest`, `session`, `graphql` and
`restAnswer` are gone. `fougere serve` now answers the session and GraphQL beside REST.
