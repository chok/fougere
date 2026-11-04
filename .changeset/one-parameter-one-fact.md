---
'@fougere/compiler': minor
---

`Fact<A | B>` and `Pipe<A | B>` refuse the boot with `fact-contract-ambiguous`. A binding names one fact, so such a parameter listened to a name nothing could announce, and was never called.
