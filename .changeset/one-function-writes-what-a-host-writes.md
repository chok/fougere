---
'@fougere/compiler': minor
'@fougere/vite': patch
'@fougere/next': patch
---

`writeDerived(root)` writes the statement, the facade and the names from one scan, each file renamed into place. Vite and Next call it rather than each holding a copy.
