---
'@fougere/core': patch
'@fougere/container': patch
---

A boot that refuses releases what it took, from its first line — and a scope closes every
sibling.

`createApp` held the whole installation inline, 324 lines between reading the model and
assembling the app, so its `try` could only open where `release` was already in scope: at
the ascent. Everything before it opened sources and built storages and walked out holding
them. `installFrond(frond, assembly)` names what a frond is put into — one container, one
route table, one emission list — and `release` moved up beside the container, so before the
app exists it runs the two levels that do.

In the container, closing a child splices it out of `children` and the loop walked that same
array: `[first, second]` released `second`, and `first` stayed open with whatever it held for
the life of the process.
