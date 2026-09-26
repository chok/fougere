import { entity, text, bool } from "@fougere/schema";

/**
 * `fougere new [name]` — a project, composed on one screen when the flags state nothing, and
 * written from the flags when `--frond`, `--app` or `--bare` say it all.
 */
export default class New extends entity({
  name: text({ description: "Project name — its directory and its package" }),
  force: bool({ description: "Overwrite existing directory", default: false }),
  bare: bool({ description: "No fronds, no apps — the empty workspace, no prompt", default: false }),
  local: bool({ description: "Link @fougere/* to this monorepo (dev — installs offline)", default: false }),
  frond: text({ description: "Fronds to add, no prompt — 'blog' or 'blog:shop', comma-separated", default: "" }),
  app: text({ description: "Apps to add, no prompt — 'nuxt' or 'nuxt:web', comma-separated", default: "" }),
}) {}
