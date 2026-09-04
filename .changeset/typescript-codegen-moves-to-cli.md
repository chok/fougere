---
'@fougere/schema': minor
'@fougere/cli': patch
---

`EntityTypes` and `FacadeTypes` move to the CLI, which was their only reader.

Neither derives from anything the schema owns: `EntityTypes` reads a `SchemaDescriptor`
and touches no field, no axis and no judge, while `FacadeTypes` writes the name
`Invocation`, which belongs to the call contract. Their two copies of `propertyKey` and
`docCommentOf` become one. Removed from the `@fougere/schema` root with no deprecated
re-export.
