---
"@fougere/core": patch
---

The door check asks for an operation someone wrote. It asked `post.list` — a prefab op,
whose contract is a static that survives any build — and called the door fine while every
hand-written operation of a fresh project went unserved. `post.listPublished` is read
from source at scan time and carried by nothing at runtime, so it answers only when the
statement the host boots from carried it across.
