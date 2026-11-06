---
'@fougere/cli': patch
---

`yarn create fougere` works under yarn 4. Copying a template with `cpSync` answered `ENOENT` on a package yarn leaves in its zip.
