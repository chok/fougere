---
'@fougere/core': patch
---

`Together<[Ledger]>` no longer reaches an entity an aggregate owns. Like `LedgerStorage`, it is refused at boot unless the aggregate itself asks for it.
