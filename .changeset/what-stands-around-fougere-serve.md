---
'@fougere/core': minor
'@fougere/transport-http': minor
'@fougere/cli': minor
---

`server: { use: [cors()] }` in `fougere.config.ts` stands srvx middlewares around what `fougere serve`
answers beside its envelope — REST, GraphQL, and a request none of them claims, which a middleware
may answer itself. Outside in, and never around the envelope its peers call. `serve()` takes the
same list as `use`.
