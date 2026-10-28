---
'@fougere/core': minor
---

`Collect<User>` and `Present<Post>` are ports. A collector or a presenter realizes its key, and a link stands in front of either: `implements Partial<Collect<User>>` with `inner: Collect<User>`, or `implements Partial<Present<Post>>` with `inner`, whose methods are fields of its own. Two collectors of one type refuse with `port-implemented-twice` (`collector-ambiguous` is gone) and `ports:` settles them. A field two classes of one chain compute refuses with `presenter-field-twice`. `ModuleExtension`, its `install` and `steps`, and the `presenters` extension are gone: `app.extensions()` no longer lists `presenters`.
