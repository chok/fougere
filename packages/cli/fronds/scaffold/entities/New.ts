import { entity, text, bool } from "@fougere/schema";

/** `fougere new [name]` — the guided workspace composer (fronds, then apps). */
export default class New extends entity({
  name: text({ description: "Workspace name" }),
  force: bool({ description: "Overwrite existing directory", default: false }),
}) {}
