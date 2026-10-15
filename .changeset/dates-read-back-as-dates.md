---
'@fougere/schema': patch
'@fougere/adapter-file': patch
---

A date is read back as a `Date` when its field is `readOnly`, and when it comes from the file source. Both used to hand back a string.
