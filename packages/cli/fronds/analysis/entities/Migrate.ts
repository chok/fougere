import { entity, bool, optional, text } from "@fougere/schema";

/** `fougere migrate` — realise the frozen steps the database has not caught up with. */
export default class Migrate extends entity({
  apply: bool({ default: false, description: "Run it. Without this the plan is printed and nothing moves" }),
  root: optional(text({ description: "Project to read. Default: the current directory" })),
  json: bool({ default: false, description: "Print the report as JSON, with nothing else on stdout" }),
}) {}
