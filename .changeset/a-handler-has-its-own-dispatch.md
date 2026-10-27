---
'@fougere/core': minor
---

`Dispatcher<PostHandler>` stands around that handler's calls alone, inside the frond's `Dispatcher`:
`class PostAudit implements Partial<Dispatcher<PostHandler>>`, asking for `inner: Dispatcher<PostHandler>`.
