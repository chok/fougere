---
'@fougere/schema': minor
'@fougere/adapter-sql': patch
---

An axis states its format as a JSON Schema, and one door onto the engine reads every one.

`AdapterFieldValidator` is gone: `JsonSchemaValidator` judges a field's value, a declaration and
an adapter's entries, and `JsonSchema` names the type a format has. `role`, `lifecycle`,
`boundary` and `meta` state their format beside their type, so the validators written by hand
are gone with the messages that copied the token lists. A card is refused at `new Field`, like
a declaration, so `admitWire` and `oneOfTokens` are gone too. A refusal carries the engine's
message, and a key an axis does not read is refused: `lifecycle: { craete: 'now' }` used to pass.
