import { entity, text, bool } from "@fougere/schema";

/**
 * `fougere new [name]` — the workspace composer.
 *
 * Guided when it has a TTY and nothing to compose from; stated when `--frond` or
 * `--app` is given, which is the only form a script, a CI job or an agent can drive.
 * `--bare` is the third: the empty shell, nothing composed.
 */
export default class New extends entity({
  name: text({ description: "Workspace name" }),
  force: bool({ description: "Overwrite existing directory", default: false }),
  bare: bool({ description: "Skip the guided flow — just the empty shell", default: false }),
  local: bool({ description: "Link @fougere/* to this monorepo (dev — installs offline)", default: false }),
  frond: text({ description: "Fronds to add, no prompt — 'blog' or 'blog:shop', comma-separated", default: "" }),
  app: text({ description: "Apps to add, no prompt — 'nuxt' or 'nuxt:web', comma-separated", default: "" }),
}) {}
