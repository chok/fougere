---
'@fougere/cli': minor
---

`fougere keys` writes `fougere.key` at the root, because `.fougere/` holds only what can be computed again. Move an existing `.fougere/root.key` there before running `fougere grant`: a new key recognizes no grant issued so far. The starter ignores `.fougere`, and a published tarball no longer carries one under `templates/`.
