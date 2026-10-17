---
'@fougere/container': minor
'@fougere/core': minor
'@fougere/testing': minor
---

A key has one owner in a scope. `register` and `registerValue` refuse a name the scope already holds, where they used to replace it in silence; `replace` and `replaceValue` stand in place of what answers, here or in a parent, and refuse a name nothing holds. A child scope may still register a name its parent holds.

Breaking: code that registered the same name twice in one scope now throws — call `replace` where standing in its place is the point.

A boot whose check already refused a frond now names every frond that breaks a rule, not the first. Refusals that cited `--fronds` and `remotes:` name `only:` and `fronds: { <frond>: { remote } }`.
