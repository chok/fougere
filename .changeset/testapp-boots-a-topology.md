---
'@fougere/testing': patch
---

`testApp({ topology: true })` boots: it used to refuse whenever `fronds:` placed a frond at an address. A test can now boot the whole project as deployed, without the other processes running.
