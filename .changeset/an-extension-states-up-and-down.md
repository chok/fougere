---
'@fougere/core': major
---

An extension states `up`, `down`, `fronds` and `state`: `install` and `steps` leave the public `Extension`,
which nothing outside core read. They stay the doors a module of the kernel plugs in through
(`ModuleExtension`, `presenters()` among them), and a module stating only them is no longer taken for an
extension.
