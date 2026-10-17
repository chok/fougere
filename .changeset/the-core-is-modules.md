---
'@fougere/core': minor
---

The core is cut into modules over two primitives, with no change to what an app declares. A binding source (`BindingSources`) says where a parameter's value comes from beyond the request — a fact, a link, a collector — and is asked before the request's own parts. An answer step runs over a handler's answer before its view projects it; a presenter is one. Relations, facts, frames and the declared topology each live in one place, and the checks fail when two of them start reading each other.
