---
'@fougere/core': minor
---

An entry of `fronds:` is an object, never a string: `blog: { remote: 'http://…' }` for a frond that answers elsewhere, `'@fougere/log': { options: './lines.jsonl' }` for a module key. The string used to mean an address under one key and an argument under another; it now refuses, naming the object to write.
