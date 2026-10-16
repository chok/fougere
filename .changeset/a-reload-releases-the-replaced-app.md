---
'@fougere/app': patch
---

A reload after `configureFougere` or `extendFougere` now releases the app they replaced. Before, the old app kept serving with its storage open.
