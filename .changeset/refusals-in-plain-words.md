---
'@fougere/core': patch
'@fougere/schema': patch
'@fougere/registry': patch
'@fougere/container': patch
---

Refusals and warnings say what is wrong and the line to write, without explaining the mechanism:
`ItemHandler asks for ItemStorage. Ask for the repository instead: constructor(private item: Repository<Item>) {}.`
