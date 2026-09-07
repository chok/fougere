---
"@fougere/core": patch
---

A filter is judged the way a write is. `where` was the one entrance to the read port with
no judge at all — a field the entity does not declare passed, and so did a value the field
would refuse on the way in — while the admin door copies a browser's filter into it
verbatim. A criterion may still name a set, which is the one thing the write door refuses:
an array is judged member by member, since that is what `IN` binds.

And a filter on a field the door does not hand back is SAID, not refused: `output(schema)`
narrows what is returned and has never narrowed what is asked, so refusing it today would
break a GraphQL relation batch on the way to closing a hole. Measured across the
repository: zero warnings, which is what a refusal will need before it can be one.
