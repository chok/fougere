import { entity, text, bool } from "@fougere/schema";

/** `fougere new [name]` — the workspace composer. Guided by default; --bare for an empty shell. */
export default class New extends entity({
  name: text({ description: "Workspace name" }),
  force: bool({ description: "Overwrite existing directory", default: false }),
  bare: bool({ description: "Skip the guided flow — just the empty shell", default: false }),
  local: bool({ description: "Link @fougere/* to this monorepo (dev — installs offline)", default: false }),
}) {}
