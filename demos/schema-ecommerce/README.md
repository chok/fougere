# schema-ecommerce

## Why this one still wires GraphQL by hand

Every other demo declares `adapters: { graphql: true }` and writes no schema code at
all. This one deliberately does not: it uses the low-level primitives
(`registerType`, `registerInput`, `registerOperations`) against ORMs it built itself,
with no frond, no scan and no `fougere.config.ts`.

That is the point — it shows `@fougere/adapter-graphql` working as **the piece on its
own**, for someone who wants Entity → GraphQL and none of the framework around it.
The 221 lines of `src/adapter-graphql.ts` are what you write when you take that piece
alone, and the one line in every other demo is what you write when you take the
framework.
