---
'@fougere/adapter-graphql': minor
---

Every operation has its GraphQL field, whatever it answers. A `string` or a `number` answer has its scalar, `void` a nullable `Boolean`, and an object no schema states is a `String` holding its JSON. Such an op used to be left out in silence, or typed as its handler's entity, which it did not answer.
