---
'@fougere/core': minor
'@fougere/observability': minor
'@fougere/calls': minor
'@fougere/admin': minor
'@fougere/cli': minor
---

A topology has two halves, and only one was reported.

`rpc.topology` counts what ANSWERED, so a frond that never did is absent from it — three
processes at rest reported as a monolith, and a node that went down vanished instead of showing.
`declaredTopologyOf` reads `remotes:` and the handlers' dependencies beside the counted half,
never merged into it, so a declared dependency nothing has ever answered is a dead edge rather
than an absence.

`TopologyReport` carries `declared`, a new required field: code that READS the report is
unaffected, code that builds one — a test double — is not.

Putting the two side by side found its first disagreement the same day. A frond whose code sits
in the project is scanned, so `remotes:` leaves it in `app.fronds`, and the counted half answered
`local` for a frond every call reached over HTTP. It is named there now only once it has
answered, like any other remote.

`@fougere/calls` drops the copy it held privately. `@fougere/admin` draws the graph: nodes in
HTML over an SVG that holds only the lines, placed by `@dagrejs/dagre` — a new dependency, 16 KB,
layout only, because a library that paints its own canvas cannot read a MUI theme. `fougere
graph` gains the frond altitude above the entity one.
