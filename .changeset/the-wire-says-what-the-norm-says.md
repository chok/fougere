---
'@fougere/core': minor
'@fougere/schema': minor
'@fougere/adapter-rest': minor
'@fougere/app': minor
---

Breaking: `VALIDATION_FAILED` answers 422, as RFC 9110 has it for a well-formed body the server refuses. A REST list reads its page and its filters off the query string (`?limit=20&name=Bob`), `json(Entity)` refuses a key the entity does not declare, and a route with no prefix and no frond segment answers. Writes return their row in the same statement, a presenter does not compute a field the answer already carries, and an operation builds no event nobody observes.
