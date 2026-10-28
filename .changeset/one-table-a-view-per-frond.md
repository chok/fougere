---
'@fougere/core': minor
'@fougere/adapter-sql': minor
'@fougere/adapter-memory': minor
'@fougere/adapter-graphql': major
'@fougere/testing': patch
---

Two fronds may each declare an entity of one name: in one source they are two views of one table, its
union, each reading and writing its own fields; a field declared two ways refuses the boot
(`table-contradicted`). A GraphQL type is named after its frond first — `BlogPost`, `BlogPostList`,
`CreateBlogPostInput` — always, so two fronds' `Author` are two types; root fields keep their names.
