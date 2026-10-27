---
'@fougere/core': major
'@fougere/compiler': minor
'@fougere/adapter-rest': major
---

What stands around a REST request is a link in front of `Rest`, the port REST's door declares
(`ProtocolType.port`): `implements Partial<Rest>` around every route of a frond, `extends Rest<PostHandler>`
with `super(inner)` around one handler's, one method per op. A refusal at a door is an answer, so a link
outside it still decorates it. A port with a subject is keyed as written — `Rest<PostHandler>` — which no
class name can take, and the scan reads it on every side. `DoorMiddleware`, `RestMiddleware()`, the
`middlewares/` directory and the `middlewares:` order are gone.
