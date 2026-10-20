import { entity, text, bool, oneOf, optional } from "@fougere/schema";
import { PackageManager } from "../../../src/scaffold/PackageManager.js";

/**
 * `fougere new [name]` — a project, composed on one screen when the flags state nothing, and
 * written from the flags when `--frond`, `--app` or `--bare` say it all.
 */
export default class New extends entity({
  name: text({ description: "Project name — its directory and its package" }),
  force: bool({ description: "Replace an existing directory, without asking", default: false }),
  bare: bool({ description: "No fronds, no apps — the empty workspace, no prompt", default: false }),
  local: bool({ description: "Link @fougere/* to this monorepo (dev — installs offline)", default: false }),
  frond: text({ description: "Fronds to add, no prompt — 'blog' or 'blog:shop', comma-separated", default: "" }),
  app: text({ description: "Apps to add, no prompt — 'nuxt' or 'nuxt:web', comma-separated", default: "" }),
  packageManager: optional(oneOf(...PackageManager.names, { description: "Write the project for this one — by default the one that ran the command" })),
}) {}
