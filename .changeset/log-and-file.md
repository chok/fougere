---
'@fougere/log': minor
---

`log()` writes the two lines of each call and nothing else; the file is its own extension, `file(path)`, which every line of the process reaches. `log(path)` is gone: write `platform: [log(), file(path)]`.
