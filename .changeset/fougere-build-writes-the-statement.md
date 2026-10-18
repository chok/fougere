---
'@fougere/cli': minor
'@fougere/compiler': minor
---

`fougere build` writes `.fougere/fronds.generated.ts` — the statement, imports and `frond()` calls —
instead of `.fougere/scan.generated.ts`. A Worker boots from `createApp({ fronds, vocabulary })`;
`emitStatement(scan, { outFile })` writes its imports relative to the file, so Node and esbuild
follow them with no alias.
