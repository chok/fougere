---
'@fougere/defaults': minor
'@fougere/app': minor
'@fougere/core': minor
'@fougere/compiler': minor
---

Every host boots from a statement: the `fronds.ts` a project wrote, or the one the scan writes for
it at `.fougere/fronds.generated.ts` (`statementOf(root)`, `@fougere/defaults`). `boot()`,
`bootApp()`, `testApp()` and the web hosts no longer hand `createApp` a scan. The statement is the
project's, whole — `only:` filters it — and it carries `files:`, the file each value is declared
in, so a boot refusal still names one. Measured on `demos/ports-swap`: about 20 ms more per boot
that scans, the price of writing the file and importing it.
