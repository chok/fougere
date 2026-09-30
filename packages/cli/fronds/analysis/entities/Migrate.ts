import { entity, bool, optional, text } from "@fougere/schema";

/** `fougere migrate` — bring the database up to what `fougere freeze` recorded. */
export default class Migrate extends entity({
  apply: bool({ default: false, description: "Run it. Without this the plan is printed and nothing moves" }),
  latest: bool({ default: false, description: "Follow the entities as they are, frozen or not — for a local database" }),
  root: optional(text({ description: "Project to read. Default: the current directory" })),
  json: bool({ default: false, description: "Print the report as JSON, with nothing else on stdout" }),
}) {}
