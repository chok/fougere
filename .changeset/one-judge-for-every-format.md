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

`FIELD_FORMAT` composes the four keys into one document: each format carries its own `$id`, is
held whole in `$defs` and cited by `$ref`, and `propertyNames` lists the legal keys — so a key
nothing states is refused, where it used to be dropped in silence. A value JSON cannot hold, a
function for instance, is refused with its path rather than thrown past the caller.
