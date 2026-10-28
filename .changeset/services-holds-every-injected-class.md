---
'@fougere/core': minor
'@fougere/compiler': minor
---

`collectors/`, `presenters/` and `repositories/` are no longer convention directories: every class a frond injects sits in `services/`, and what it extends says what it is — `Collect<User>`, `Present<Post>`, `Repository<Post>`. Move the files there; a class left in one of the three is not scanned, and `fougere check` names the directory. `conventions: { dirs }` loses the three keys, and `providerDirsOf` is gone.
