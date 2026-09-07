---
"@fougere/core": minor
"@fougere/adapter-sql": minor
---

A criterion can compare. `where` knew equality and membership, while nearly everything
worth filtering on is a range — land over 1 500, price under 400 000, built after 1900 —
and the only way out was `storage.client`, the path with no judge and no codecs.

`gte`, `lte`, `gt`, `lt`, `ne`, `between`, `contains`, `notIn` and `isNull`. `eq` and `in`
are deliberately absent: a bare value already means equality and an array already means
membership, and a second spelling would make one criterion sayable two ways.

A comparison is told from a value that IS an object by the FIELD, never by the criterion:
`json()` admits any shape, so reading the criterion would make a stored object
unfilterable the day its keys happened to spell an operator. Both realizations compile it
— SQL and the store the memory and file adapters derive from — and a misspelled comparison
is refused rather than dropped.
